import { describe, it, expect } from "vitest";
import {
  normalizeTags,
  getPeriodStart,
  computeTotals,
  normalizeEndOfDayHour,
  getDayWindowStartMs,
  getSessionContributionMs,
  getResetSessionEndedAt,
  createResetSessionRecord
} from "./stats.js";

describe("normalizeTags", () => {
  it("returns empty array for empty string", () => {
    expect(normalizeTags("")).toEqual([]);
  });

  it("splits comma-separated tags", () => {
    expect(normalizeTags("work,study")).toEqual(["work", "study"]);
  });

  it("trims whitespace around each tag", () => {
    expect(normalizeTags(" work , study ")).toEqual(["work", "study"]);
  });

  it("lowercases each tag", () => {
    expect(normalizeTags("Work,STUDY")).toEqual(["work", "study"]);
  });

  it("deduplicates tags", () => {
    expect(normalizeTags("work,work,study")).toEqual(["work", "study"]);
  });

  it("drops empty segments from consecutive commas", () => {
    expect(normalizeTags("work,,study")).toEqual(["work", "study"]);
  });

  it("handles a single tag without a comma", () => {
    expect(normalizeTags("coding")).toEqual(["coding"]);
  });
});

describe("getPeriodStart", () => {
  // Monday 2 June 2025 09:00 UTC (day-of-week = 1)
  const MONDAY_TS = new Date("2025-06-02T09:00:00").getTime();
  // Sunday 1 June 2025 09:00 UTC (day-of-week = 0)
  const SUNDAY_TS = new Date("2025-06-01T09:00:00").getTime();

  it("week: returns the Monday of the current week at midnight", () => {
    const result = getPeriodStart(MONDAY_TS, "week");
    const d = new Date(result);
    expect(d.getDay()).toBe(1); // Monday
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it("week: when today is Sunday returns the previous Monday", () => {
    const result = getPeriodStart(SUNDAY_TS, "week");
    const d = new Date(result);
    expect(d.getDay()).toBe(1); // Monday
    // Sunday (2025-06-01) minus 6 days = Monday 2025-05-26
    expect(d.getDate()).toBe(26);
    expect(d.getMonth()).toBe(4); // May
  });

  it("month: returns the 1st of the current month at midnight", () => {
    const result = getPeriodStart(MONDAY_TS, "month");
    const d = new Date(result);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("month: works across a year boundary (January)", () => {
    const jan15 = new Date("2025-01-15T12:00:00").getTime();
    const result = getPeriodStart(jan15, "month");
    const d = new Date(result);
    expect(d.getMonth()).toBe(0); // January
    expect(d.getDate()).toBe(1);
  });
});

describe("computeTotals", () => {
  // Pin "now" to a known Tuesday 2025-06-03 12:00:00 local time
  const NOW = new Date("2025-06-03T12:00:00").getTime();

  const weekStart = getPeriodStart(NOW, "week");
  const monthStart = getPeriodStart(NOW, "month");

  it("returns zeros when there are no sessions", () => {
    const result = computeTotals({ now: NOW });
    expect(result.weekHours).toBe(0);
    expect(result.monthHours).toBe(0);
  });

  it("counts a session that ended within the week and month", () => {
    const sessions = [
      { focusedMs: 60 * 60 * 1000, endedAt: weekStart + 1000, tags: [] }
    ];
    const result = computeTotals({ sessions, now: NOW });
    expect(result.weekHours).toBeCloseTo(1);
    expect(result.monthHours).toBeCloseTo(1);
  });

  it("excludes a session that ended before the week start", () => {
    const sessions = [
      { focusedMs: 60 * 60 * 1000, endedAt: weekStart - 1000, tags: [] }
    ];
    const result = computeTotals({ sessions, now: NOW });
    expect(result.weekHours).toBe(0);
  });

  it("includes a session that ended before the week but within the month", () => {
    // monthStart is always <= weekStart
    const sessions = [
      { focusedMs: 30 * 60 * 1000, endedAt: monthStart + 1000, tags: [] }
    ];
    const result = computeTotals({ sessions, now: NOW });
    expect(result.weekHours).toBe(0);
    expect(result.monthHours).toBeCloseTo(0.5);
  });

  it("filters sessions by tag when filterTag is provided", () => {
    const sessions = [
      { focusedMs: 60 * 60 * 1000, endedAt: weekStart + 1000, tags: ["work"] },
      { focusedMs: 30 * 60 * 1000, endedAt: weekStart + 2000, tags: ["study"] }
    ];
    const result = computeTotals({ sessions, filterTag: "work", now: NOW });
    expect(result.weekHours).toBeCloseTo(1);
  });

  it("includes currentSession focusedMs in totals", () => {
    const currentSession = {
      focusedMs: 45 * 60 * 1000,
      lastCommittedAt: NOW - 1000,
      tags: []
    };
    const result = computeTotals({ currentSession, now: NOW });
    expect(result.weekHours).toBeCloseTo(0.75);
  });

  it("excludes currentSession when its focusedMs is 0", () => {
    const currentSession = { focusedMs: 0, lastCommittedAt: NOW - 1000, tags: [] };
    const result = computeTotals({ currentSession, now: NOW });
    expect(result.weekHours).toBe(0);
  });

  it("weekAverageHours divides by elapsed days in the week", () => {
    const sessions = [{ focusedMs: 7 * 60 * 60 * 1000, endedAt: weekStart + 1000, tags: [] }];
    const result = computeTotals({ sessions, now: NOW });
    const elapsedDays = Math.max(1, Math.ceil((NOW - weekStart + 1) / (24 * 60 * 60 * 1000)));
    expect(result.weekAverageHours).toBeCloseTo(result.weekHours / elapsedDays);
  });
});

describe("reset behavior", () => {
  it("keeps the last committed session time instead of extending it on reset", () => {
    const now = new Date("2025-07-21T12:00:00").getTime();
    const lastCommittedAt = new Date("2025-07-21T11:30:00").getTime();

    expect(getResetSessionEndedAt({ lastCommittedAt }, now)).toBe(lastCommittedAt);
    expect(getResetSessionEndedAt(null, now)).toBe(now);
  });

  it("records reset metadata without counting reset sessions toward focus totals", () => {
    const now = new Date("2025-07-21T12:00:00").getTime();
    const startedAt = now - 10 * 60 * 1000;
    const currentSession = {
      startedAt,
      focusedMs: 7 * 60 * 1000,
      lastCommittedAt: now - 3 * 60 * 1000,
      tags: ["work"]
    };

    const record = createResetSessionRecord(currentSession, 25 * 60 * 1000, now);

    expect(record.startedAt).toBe(startedAt);
    expect(record.endedAt).toBe(now);
    expect(record.actualDurationMs).toBe(10 * 60 * 1000);
    expect(record.originalDurationMs).toBe(25 * 60 * 1000);
    expect(record.focusedMs).toBe(0);
    expect(record.tags).toEqual(["work"]);

    const totals = computeTotals({ sessions: [record], now });
    expect(totals.weekHours).toBe(0);
    expect(totals.monthHours).toBe(0);
  });
});

describe("end-of-day helpers", () => {
  it("normalizes end-of-day value with fallback", () => {
    expect(normalizeEndOfDayHour("2", 0)).toBe(2);
    expect(normalizeEndOfDayHour("invalid", 3)).toBe(3);
  });

  it("uses previous day cutoff when now is before cutoff hour", () => {
    const now = new Date("2025-07-21T01:30:00").getTime();
    const start = getDayWindowStartMs(now, 2);
    const startDate = new Date(start);

    expect(startDate.getHours()).toBe(2);
    expect(startDate.getDate()).toBe(new Date("2025-07-20T02:00:00").getDate());
  });

  it("uses same-day cutoff when now is after cutoff hour", () => {
    const now = new Date("2025-07-21T03:30:00").getTime();
    const start = getDayWindowStartMs(now, 2);
    const startDate = new Date(start);

    expect(startDate.getHours()).toBe(2);
    expect(startDate.getDate()).toBe(new Date("2025-07-21T02:00:00").getDate());
  });

  it("attributes only overlapped portion of a cross-boundary session", () => {
    const session = {
      startedAt: new Date("2025-07-20T23:30:00").getTime(),
      endedAt: new Date("2025-07-21T00:30:00").getTime(),
      focusedMs: 60 * 60 * 1000
    };
    const windowStart = new Date("2025-07-21T00:00:00").getTime();
    const windowEnd = new Date("2025-07-22T00:00:00").getTime();

    expect(getSessionContributionMs(session, windowStart, windowEnd)).toBe(30 * 60 * 1000);
  });
});
