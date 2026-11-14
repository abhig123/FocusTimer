import { normalizeSiteEntry, isHostnameInList } from "./sites.js";
import type { BlockReason, BlockingSettings } from "./types.js";

function isHttpOrHttps(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

export function getNavigationBlockReason(url: string, timerStatus: string, settings: BlockingSettings): BlockReason | null {
  if (timerStatus !== "running") {
    return null;
  }

  if (!isHttpOrHttps(url)) return null;

  let hostname = "";
  try {
    hostname = normalizeSiteEntry(new URL(url).hostname);
  } catch {
    return null;
  }

  if (!hostname) return null;

  const { listMode, blocklistSites, allowlistSites } = settings;

  if (listMode === "blocklist") {
    return isHostnameInList(hostname, blocklistSites) ? "blocked" : null;
  }

  return isHostnameInList(hostname, allowlistSites) ? null : "not-allowed";
}

