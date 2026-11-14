import { getNavigationBlockReason } from "./rules.js";
import { normalizeSiteEntry } from "./sites.js";
import type { BlockReason, BlockingSettings } from "./types.js";

export const BLOCKED_PAGE_PATH = "src/features/blocking/blocked.html";

export function buildBlockedPageUrl(reason: BlockReason, originalUrl: string): string {
  let site = "";
  try {
    site = normalizeSiteEntry(new URL(originalUrl).hostname);
  } catch {
    site = "";
  }

  const params = new URLSearchParams({
    reason,
    site,
    url: originalUrl
  });

  return chrome.runtime.getURL(`${BLOCKED_PAGE_PATH}?${params.toString()}`);
}

export async function enforceWebsiteRules(tabId: number, url: string, timerStatus: string, settings: BlockingSettings): Promise<void> {
  const reason = getNavigationBlockReason(url, timerStatus, settings);
  if (!reason) return;

  const blockedPageUrl = buildBlockedPageUrl(reason, url);
  await chrome.tabs.update(tabId, { url: blockedPageUrl });
}

