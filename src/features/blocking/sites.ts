export function normalizeSiteEntry(site: unknown): string {
  if (typeof site !== "string") return "";
  let value = site.trim().toLowerCase();
  if (!value) return "";

  value = value.replace(/^https?:\/\//, "").replace(/^www\./, "");
  value = value.split("/")[0].split("?")[0].split("#")[0].trim();
  value = value.replace(/:\d+$/, "");

  if (!value || !/[a-z0-9-]+(\.[a-z0-9-]+)+/.test(value)) return "";
  return value;
}

/** String-typed alias used by the options page. */
export function normalizeWebsite(siteInput: string): string {
  return normalizeSiteEntry(siteInput);
}

export function normalizeSiteList(sites: unknown, fallback: string[] = []): string[] {
  const source = Array.isArray(sites) ? sites : fallback;
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const rawSite of source) {
    const normalized = normalizeSiteEntry(rawSite);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
    if (unique.length >= 200) break;
  }

  return unique;
}

export function hostnameMatchesSite(hostname: string, site: string): boolean {
  return hostname === site || hostname.endsWith(`.${site}`);
}

export function isHostnameInList(hostname: string, sites: string[]): boolean {
  return sites.some((site) => hostnameMatchesSite(hostname, site));
}
