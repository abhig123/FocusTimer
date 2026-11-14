import { describe, it, expect } from "vitest";
import {
  normalizeTagOption,
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
