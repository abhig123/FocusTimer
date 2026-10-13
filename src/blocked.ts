const titleEl = document.getElementById("blocked-title");
const subtitleEl = document.getElementById("blocked-subtitle");
const siteEl = document.getElementById("blocked-site");

const params = new URLSearchParams(window.location.search);
const reason = params.get("reason") || "blocked";
const site = (params.get("site") || "").trim();

if (titleEl) {
  titleEl.textContent =
    reason === "not-allowed"
      ? "This website is not in the allowed list of websites."
      : "This website is blocked.";
}

if (subtitleEl) {
  subtitleEl.textContent =
    reason === "not-allowed"
      ? "Allowlist mode is active. Only websites in your Allowlist can be opened."
      : "Blocklist mode is active. This website is currently blocked.";
}

if (siteEl) {
  siteEl.textContent = site ? `Requested: ${site}` : "";
}
