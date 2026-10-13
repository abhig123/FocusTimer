import { describe, it, expect } from "vitest";
import {
  normalizeTagOption,
  normalizeSiteEntry,
  normalizeWebsite,
  normalizeSiteList,
  formatDuration,
  parseEditedDurationMinutes,
  toFocusText,
  toPerDayText,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES
} from "./utils.js";

// ── normalizeTagOption ─────────────────────────────────────────────

describe("normalizeTagOption", () => {
  it("returns empty string for non-string input", () => {
    expect(normalizeTagOption(42)).toBe("");
    expect(normalizeTagOption(null)).toBe("");
    expect(normalizeTagOption(undefined)).toBe("");
  });

  it("returns empty string for blank string", () => {
    expect(normalizeTagOption("   ")).toBe("");
  });

  it("strips leading # characters", () => {
    expect(normalizeTagOption("#work")).toBe("work");
    expect(normalizeTagOption("##work")).toBe("work");
  });

  it("lowercases the tag", () => {
    expect(normalizeTagOption("Work")).toBe("work");
    expect(normalizeTagOption("CODING")).toBe("coding");
  });

  it("replaces whitespace with hyphens", () => {
    expect(normalizeTagOption("my tag")).toBe("my-tag");
    expect(normalizeTagOption("  spaced  ")).toBe("spaced");
  });

  it("handles a normal tag without transformation", () => {
    expect(normalizeTagOption("study")).toBe("study");
  });
});

// ── normalizeSiteEntry ─────────────────────────────────────────────

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

// ── formatDuration ─────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats 0 ms as 00:00", () => {
    expect(formatDuration(0)).toBe("00:00");
  });

  it("formats negative ms as 00:00", () => {
    expect(formatDuration(-500)).toBe("00:00");
  });

  it("formats exactly 1 minute", () => {
    expect(formatDuration(60 * 1000)).toBe("01:00");
  });

  it("formats exactly 25 minutes", () => {
    expect(formatDuration(25 * 60 * 1000)).toBe("25:00");
  });

  it("formats 90 seconds as 01:30", () => {
    expect(formatDuration(90 * 1000)).toBe("01:30");
  });

  it("formats a partial second by ceiling to next second", () => {
    // 60.001 seconds → ceil → 61 seconds → 01:01
    expect(formatDuration(60 * 1000 + 1)).toBe("01:01");
  });

  it("pads single-digit minutes and seconds", () => {
    expect(formatDuration(5 * 1000)).toBe("00:05");
  });

  it("formats a large value (1 hour)", () => {
    expect(formatDuration(60 * 60 * 1000)).toBe("60:00");
  });
});

// ── parseEditedDurationMinutes ─────────────────────────────────────

describe("parseEditedDurationMinutes", () => {
  it("returns null for empty string", () => {
    expect(parseEditedDurationMinutes("")).toBeNull();
    expect(parseEditedDurationMinutes("   ")).toBeNull();
  });

  it("parses a plain integer as minutes", () => {
    expect(parseEditedDurationMinutes("25")).toBe(25);
  });

  it("clamps below minimum to MIN_DURATION_MINUTES", () => {
    expect(parseEditedDurationMinutes("1")).toBe(MIN_DURATION_MINUTES);
  });

  it("clamps above maximum to MAX_DURATION_MINUTES", () => {
    expect(parseEditedDurationMinutes("999")).toBe(MAX_DURATION_MINUTES);
  });

  it("parses MM:SS format and converts to whole minutes", () => {
    expect(parseEditedDurationMinutes("25:00")).toBe(25);
  });

  it("rounds partial minutes in MM:SS format", () => {
    // 25:30 = 25.5 min → rounds to 26
    expect(parseEditedDurationMinutes("25:30")).toBe(26);
  });

  it("returns null for invalid MM:SS with seconds > 59", () => {
    expect(parseEditedDurationMinutes("25:60")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(parseEditedDurationMinutes("abc")).toBeNull();
    expect(parseEditedDurationMinutes("1:2:3")).toBeNull();
  });

  it("accepts MM:SS at the minimum boundary", () => {
    expect(parseEditedDurationMinutes("10:00")).toBe(10);
  });
});

// ── toFocusText ────────────────────────────────────────────────────

describe("toFocusText", () => {
  it("formats 0 ms as 0m", () => {
    expect(toFocusText(0)).toBe("0m");
  });

  it("formats negative ms as 0m", () => {
    expect(toFocusText(-5000)).toBe("0m");
  });

  it("formats minutes only (< 1 hour)", () => {
    expect(toFocusText(30 * 60 * 1000)).toBe("30m");
  });

  it("formats whole hours (no minutes)", () => {
    expect(toFocusText(2 * 60 * 60 * 1000)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(toFocusText(90 * 60 * 1000)).toBe("1h 30m");
  });

  it("truncates (floors) sub-minute remainders", () => {
    // 61.9 minutes → floors to 61 min → 1h 1m
    expect(toFocusText(61.9 * 60 * 1000)).toBe("1h 1m");
  });
});

// ── toPerDayText ───────────────────────────────────────────────────

describe("toPerDayText", () => {
  it("formats 0 ms as 0m/day", () => {
    expect(toPerDayText(0)).toBe("0m/day");
  });

  it("formats minutes-only duration", () => {
    expect(toPerDayText(45 * 60 * 1000)).toBe("45m/day");
  });

  it("formats whole hours", () => {
    expect(toPerDayText(3 * 60 * 60 * 1000)).toBe("3h/day");
  });

  it("formats hours and minutes", () => {
    expect(toPerDayText(150 * 60 * 1000)).toBe("2h 30m/day");
  });

  it("rounds (not floors) sub-minute remainders", () => {
    // 30.6 min → rounds to 31 min
    expect(toPerDayText(30.6 * 60 * 1000)).toBe("31m/day");
  });
});
