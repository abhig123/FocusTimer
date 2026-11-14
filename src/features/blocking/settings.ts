import { normalizeWebsite } from "./sites.js";
import type { SiteLists } from "./types.js";

type SiteListElements = {
  blocklistInput: HTMLInputElement | null;
  allowlistInput: HTMLInputElement | null;
  blocklistSites: HTMLUListElement | null;
  allowlistSites: HTMLUListElement | null;
};

type SendMessage = (type: string, payload?: unknown) => Promise<{
  state?: { settings?: Partial<SiteLists> };
}>;

export function createBlockingSettings(elements: SiteListElements, send: SendMessage) {
  let blocklistSitesState: string[] = [];
  let allowlistSitesState: string[] = [];

  function getFaviconUrl(domain: string): string {
    return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}`;
  }

  function createSiteIconElement(site: string): HTMLElement {
    const icon = document.createElement("span");
    icon.className = "site-icon";
    icon.setAttribute("aria-hidden", "true");

    const img = document.createElement("img");
    img.src = getFaviconUrl(site);
    img.alt = "";
    img.className = "site-icon-img";

    const fallbackText = document.createElement("span");
    fallbackText.className = "site-icon-fallback";
    fallbackText.textContent = site.charAt(0).toUpperCase();

    img.addEventListener("error", () => {
      icon.classList.add("site-icon-fallback-active");
    });

    icon.append(img, fallbackText);
    return icon;
  }

  function renderSiteList(container: HTMLUListElement | null, sites: string[], emptyText: string): void {
    if (!container) return;

    container.textContent = "";

    if (!sites.length) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "site-item muted";

      const emptyTextNode = document.createElement("span");
      emptyTextNode.className = "site-domain";
      emptyTextNode.textContent = emptyText;

      emptyItem.appendChild(emptyTextNode);
      container.appendChild(emptyItem);
      return;
    }

    for (const site of sites) {
      const item = document.createElement("li");
      item.className = "site-item";
      item.dataset.site = site;

      const icon = createSiteIconElement(site);

      const domain = document.createElement("span");
      domain.className = "site-domain";
      domain.textContent = site;

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-site-btn";
      removeBtn.type = "button";
      removeBtn.dataset.site = site;
      removeBtn.setAttribute("aria-label", `Remove ${site}`);
      removeBtn.title = `Remove ${site}`;
      removeBtn.textContent = "x";

      item.append(icon, domain, removeBtn);
      container.appendChild(item);
    }
  }

  function renderSiteLists(): void {
    renderSiteList(elements.blocklistSites, blocklistSitesState, "No blocked websites yet");
    renderSiteList(elements.allowlistSites, allowlistSitesState, "No allowed websites yet");
  }

  async function persistLists(): Promise<void> {
    const response = await send("UPDATE_SETTINGS", {
      blocklistSites: blocklistSitesState,
      allowlistSites: allowlistSitesState
    });

    if (response.state?.settings) {
      blocklistSitesState = Array.isArray(response.state.settings.blocklistSites)
        ? [...response.state.settings.blocklistSites]
        : blocklistSitesState;
      allowlistSitesState = Array.isArray(response.state.settings.allowlistSites)
        ? [...response.state.settings.allowlistSites]
        : allowlistSitesState;
      renderSiteLists();
    }
  }

  async function addSiteToList(which: "blocklist" | "allowlist", rawValue: string, inputEl: HTMLInputElement | null): Promise<void> {
    const site = normalizeWebsite(rawValue);
    if (!site) return;

    const target = which === "blocklist" ? blocklistSitesState : allowlistSitesState;
    if (target.includes(site)) return;

    if (inputEl) inputEl.value = "";

    target.push(site);
    target.sort((a, b) => a.localeCompare(b));
    renderSiteLists();
    await persistLists();
  }

  async function removeSiteFromList(which: "blocklist" | "allowlist", site: string): Promise<void> {
    const normalized = normalizeWebsite(site);
    if (!normalized) return;

    if (which === "blocklist") {
      blocklistSitesState = blocklistSitesState.filter((value) => value !== normalized);
    } else {
      allowlistSitesState = allowlistSitesState.filter((value) => value !== normalized);
    }

    renderSiteLists();
    await persistLists();
  }

  function wireSiteLists(): void {
    elements.blocklistInput?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void addSiteToList("blocklist", elements.blocklistInput?.value || "", elements.blocklistInput);
    });

    elements.allowlistInput?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void addSiteToList("allowlist", elements.allowlistInput?.value || "", elements.allowlistInput);
    });

    elements.blocklistSites?.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (!target.classList.contains("remove-site-btn")) return;
      const site = target.dataset.site;
      if (!site) return;
      void removeSiteFromList("blocklist", site);
    });

    elements.allowlistSites?.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (!target.classList.contains("remove-site-btn")) return;
      const site = target.dataset.site;
      if (!site) return;
      void removeSiteFromList("allowlist", site);
    });
  }

  function setLists(settings: Partial<SiteLists>): void {
    blocklistSitesState = Array.isArray(settings.blocklistSites) ? [...settings.blocklistSites] : [];
    allowlistSitesState = Array.isArray(settings.allowlistSites) ? [...settings.allowlistSites] : [];
    renderSiteLists();
  }

  function getLists(): SiteLists {
    return {
      blocklistSites: [...blocklistSitesState],
      allowlistSites: [...allowlistSitesState]
    };
  }

  return { setLists, getLists, wireSiteLists };
}
