import { describe, it, expect } from "vitest";
import { normalizeSiteEntry, normalizeWebsite, normalizeSiteList, hostnameMatchesSite } from "./sites.js";

describe("normalizeSiteEntry", () => {
  it("returns empty string for non-string input", () => {
    expect(normalizeSiteEntry(null)).toBe("");
    expect(normalizeSiteEntry(42)).toBe("");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeSiteEntry("")).toBe("");
    expect(normalizeSiteEntry("   ")).toBe("");
  });

  it("strips https:// protocol", () => {
    expect(normalizeSiteEntry("https://example.com")).toBe("example.com");
  });

  it("strips http:// protocol", () => {
    expect(normalizeSiteEntry("http://example.com")).toBe("example.com");
  });

  it("strips www. prefix", () => {
    expect(normalizeSiteEntry("www.example.com")).toBe("example.com");
  });

  it("strips both protocol and www", () => {
    expect(normalizeSiteEntry("https://www.example.com")).toBe("example.com");
  });

  it("strips path after /", () => {
    expect(normalizeSiteEntry("example.com/path/to/page")).toBe("example.com");
  });

  it("strips query string", () => {
    expect(normalizeSiteEntry("example.com?q=test")).toBe("example.com");
  });

  it("strips hash fragment", () => {
    expect(normalizeSiteEntry("example.com#section")).toBe("example.com");
  });

  it("strips port numbers", () => {
    expect(normalizeSiteEntry("example.com:8080")).toBe("example.com");
  });

  it("returns empty string for invalid domain (no dot)", () => {
    expect(normalizeSiteEntry("notadomain")).toBe("");
  });

  it("lowercases the domain", () => {
    expect(normalizeSiteEntry("Example.COM")).toBe("example.com");
  });

  it("handles subdomains", () => {
    expect(normalizeSiteEntry("sub.example.com")).toBe("sub.example.com");
  });
});

// ── normalizeWebsite (alias) ───────────────────────────────────────

describe("normalizeWebsite", () => {
  it("behaves the same as normalizeSiteEntry for valid input", () => {
    expect(normalizeWebsite("https://www.example.com/path")).toBe("example.com");
  });

  it("returns empty string for invalid input", () => {
    expect(normalizeWebsite("notadomain")).toBe("");
  });
});

// ── normalizeSiteList ──────────────────────────────────────────────

describe("normalizeSiteList", () => {
  it("returns empty array for non-array input with no fallback", () => {
    expect(normalizeSiteList(null)).toEqual([]);
  });

  it("uses fallback when input is not an array", () => {
    expect(normalizeSiteList(null, ["example.com"])).toEqual(["example.com"]);
  });

  it("deduplicates entries", () => {
    expect(normalizeSiteList(["example.com", "example.com"])).toEqual(["example.com"]);
  });

  it("deduplicates after normalization (protocol vs no protocol)", () => {
    expect(normalizeSiteList(["example.com", "https://example.com"])).toEqual(["example.com"]);
  });

  it("filters out invalid entries", () => {
    expect(normalizeSiteList(["notadomain", "example.com"])).toEqual(["example.com"]);
  });

  it("caps the list at 200 entries", () => {
    const many = Array.from({ length: 250 }, (_, i) => `site${i}.com`);
    expect(normalizeSiteList(many)).toHaveLength(200);
  });
});

describe("hostnameMatchesSite", () => {
  it("matches the exact domain and subdomains, not lookalikes", () => {
    expect(hostnameMatchesSite("example.com", "example.com")).toBe(true);
    expect(hostnameMatchesSite("music.example.com", "example.com")).toBe(true);
    expect(hostnameMatchesSite("notexample.com", "example.com")).toBe(false);
    expect(hostnameMatchesSite("example.com.other.com", "example.com")).toBe(false);
  });
});
