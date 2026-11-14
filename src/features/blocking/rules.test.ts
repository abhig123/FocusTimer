import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getNavigationBlockReason } from "./rules.js";
import { BLOCKED_PAGE_PATH, buildBlockedPageUrl, enforceWebsiteRules } from "./enforcement.js";
import type { BlockingSettings } from "./types.js";

const settings: BlockingSettings = {
  listMode: "blocklist",
  blocklistSites: ["example.com"],
  allowlistSites: ["work.com"]
};

describe("blocking rules", () => {
  it.each(["idle", "paused"])("does not block when the timer is %s", (status) => {
    expect(getNavigationBlockReason("https://example.com", status, settings)).toBeNull();
  });

  it("blocks listed domains and subdomains but not lookalikes", () => {
    expect(getNavigationBlockReason("https://www.example.com/path", "running", settings)).toBe("blocked");
    expect(getNavigationBlockReason("http://music.example.com", "running", settings)).toBe("blocked");
    expect(getNavigationBlockReason("https://notexample.com", "running", settings)).toBeNull();
    expect(getNavigationBlockReason("https://example.com.other.com", "running", settings)).toBeNull();
  });

  it("allows only allowlisted domains and subdomains in allowlist mode", () => {
    const allowlist: BlockingSettings = { ...settings, listMode: "allowlist" };
    expect(getNavigationBlockReason("https://work.com", "running", allowlist)).toBeNull();
    expect(getNavigationBlockReason("https://docs.work.com", "running", allowlist)).toBeNull();
    expect(getNavigationBlockReason("https://example.com", "running", allowlist)).toBe("not-allowed");
  });

  it("preserves empty-list behavior", () => {
    const empty: BlockingSettings = { listMode: "blocklist", blocklistSites: [], allowlistSites: [] };
    expect(getNavigationBlockReason("https://example.com", "running", empty)).toBeNull();
    expect(getNavigationBlockReason("https://example.com", "running", { ...empty, listMode: "allowlist" })).toBe("not-allowed");
  });

  it.each(["chrome://settings", "chrome-extension://test/src/features/blocking/blocked.html", "file:///tmp/test.html", "https://", "https://localhost", "invalid"])("ignores unsupported or invalid URLs: %s", (url) => {
    expect(getNavigationBlockReason(url, "running", { ...settings, listMode: "allowlist" })).toBeNull();
  });
});

describe("tab enforcement", () => {
  const update = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.stubGlobal("chrome", {
      runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
      tabs: { update }
    });
    update.mockClear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("redirects to the relocated blocked page with encoded original URL", async () => {
    const original = "https://www.example.com/path?q=a&next=%2Fhome#section";
    await enforceWebsiteRules(42, original, "running", settings);
    expect(update).toHaveBeenCalledOnce();
    const [tabId, { url }] = update.mock.calls[0] as unknown as [number, { url: string }];
    const redirect = new URL(url);
    expect(tabId).toBe(42);
    expect(redirect.pathname).toBe(`/${BLOCKED_PAGE_PATH}`);
    expect(redirect.searchParams.get("reason")).toBe("blocked");
    expect(redirect.searchParams.get("site")).toBe("example.com");
    expect(redirect.searchParams.get("url")).toBe(original);
  });

  it("does not redirect allowed URLs, paused timers, or the blocked page", async () => {
    await enforceWebsiteRules(42, "https://work.com", "running", settings);
    await enforceWebsiteRules(42, "https://example.com", "paused", settings);
    await enforceWebsiteRules(42, buildBlockedPageUrl("blocked", "https://example.com"), "running", { ...settings, listMode: "allowlist" });
    expect(update).not.toHaveBeenCalled();
  });

  it("uses the allowlist reason", async () => {
    await enforceWebsiteRules(42, "https://other.com", "running", { ...settings, listMode: "allowlist" });
    const [, { url }] = update.mock.calls[0] as unknown as [number, { url: string }];
    expect(new URL(url).searchParams.get("reason")).toBe("not-allowed");
  });

  it("propagates redirect failures for the background listener to handle", async () => {
    update.mockRejectedValueOnce(new Error("Tab closed"));
    await expect(enforceWebsiteRules(42, "https://example.com", "running", settings)).rejects.toThrow("Tab closed");
  });
});
