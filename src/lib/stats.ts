export function normalizeTags(raw: string): string[] {
  if (!raw) return [];
  const parts = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(parts)];
}

export type EndOfDayHour = 23 | 0 | 1 | 2 | 3 | 4;

export function normalizeEndOfDayHour(value: unknown, fallback: EndOfDayHour = 0): EndOfDayHour {
  const parsed = Number(value);
  if (parsed === 23 || parsed === 0 || parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4) {
    return parsed;
  }

  return fallback;
}

export function getDayWindowStartMs(now: number, endOfDayHour: EndOfDayHour): number {
  const cutoff = new Date(now);
  cutoff.setHours(endOfDayHour, 0, 0, 0);

  if (now < cutoff.getTime()) {
    cutoff.setDate(cutoff.getDate() - 1);
  }

  return cutoff.getTime();
}

type FocusSessionWindowInput = {
  startedAt?: number;
  endedAt?: number;
  focusedMs?: number;
};

export function getSessionContributionMs(
  session: FocusSessionWindowInput,
  windowStart: number,
  windowEnd: number
): number {
  if (!session) return 0;

  const focusedMs = Math.max(0, Number(session.focusedMs) || 0);
  if (focusedMs <= 0) return 0;

  const endedAt = Number(session.endedAt);
  if (!Number.isFinite(endedAt) || endedAt <= windowStart) return 0;

  const startedAt = Number(session.startedAt);
  const sessionStart = Number.isFinite(startedAt)
    ? Math.max(0, startedAt)
    : Math.max(0, endedAt - focusedMs);
  const sessionEnd = Math.max(sessionStart, endedAt);

  const overlapStart = Math.max(sessionStart, windowStart);
  const overlapEnd = Math.min(sessionEnd, windowEnd);
  const overlapMs = Math.max(0, overlapEnd - overlapStart);
  const spanMs = Math.max(1, sessionEnd - sessionStart);
  if (overlapMs <= 0) return 0;

  const ratio = Math.min(1, overlapMs / spanMs);
  const weightedMs = Math.round(focusedMs * ratio);
  return Math.min(focusedMs, overlapMs, weightedMs);
}

export function getPeriodStart(now: number, period: "week" | "month"): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  if (period === "week") {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.getTime();
  }

  d.setDate(1);
  return d.getTime();
}

export function getResetSessionEndedAt(
  currentSession: { lastCommittedAt?: number | null } | null | undefined,
  now = Date.now()
): number {
  const lastCommittedAt = Number(currentSession?.lastCommittedAt);
  if (Number.isFinite(lastCommittedAt)) {
    return lastCommittedAt;
  }

  return now;
}

export function createResetSessionRecord(
  currentSession: {
    id?: string;
    startedAt?: number | null;
    endedAt?: number | null;
    focusedMs?: number | null;
    lastCommittedAt?: number | null;
    tags?: string[];
  } | null | undefined,
  originalDurationMs: number,
  endedAt = Date.now()
): {
  id?: string;
  startedAt: number;
  endedAt: number;
  focusedMs: number;
  actualDurationMs: number;
  originalDurationMs: number;
  tags: string[];
  reason: "reset";
  synced: boolean;
} {
  const startedAt = Number(currentSession?.startedAt);
  const safeStartedAt = Number.isFinite(startedAt) ? startedAt : Math.max(0, endedAt - originalDurationMs);
  const safeEndedAt = Number.isFinite(Number(currentSession?.endedAt)) ? Number(currentSession?.endedAt) : endedAt;

  return {
    id: currentSession?.id,
    startedAt: safeStartedAt,
    endedAt: safeEndedAt,
    focusedMs: 0,
    actualDurationMs: Math.max(0, safeEndedAt - safeStartedAt),
    originalDurationMs: Math.max(0, Number(originalDurationMs) || 0),
    tags: Array.isArray(currentSession?.tags) ? currentSession.tags : [],
    reason: "reset",
    synced: false
  };
}

type FocusSession = {
  focusedMs?: number;
  endedAt?: number;
  lastCommittedAt?: number;
  tags?: string[];
};

type TotalsInput = {
  sessions?: FocusSession[];
  currentSession?: FocusSession | null;
  filterTag?: string | null;
  now?: number;
};

export function computeTotals({ sessions, currentSession, filterTag, now }: TotalsInput) {
  const currentTime = now ?? Date.now();
  const weekStart = getPeriodStart(currentTime, "week");
  const monthStart = getPeriodStart(currentTime, "month");
  const dayMs = 24 * 60 * 60 * 1000;

  const merged = [...(sessions || [])];
  if (currentSession && (currentSession.focusedMs || 0) > 0) {
    merged.push({
      focusedMs: currentSession.focusedMs,
      endedAt: currentSession.lastCommittedAt || currentTime,
      tags: currentSession.tags || []
    });
  }

  const matchesTag = (session: FocusSession) => {
    if (!filterTag) return true;
    return (session.tags || []).includes(filterTag);
  };

  const sumFocusedMs = (startAt: number) =>
    merged.reduce((sum, session) => {
      if (!matchesTag(session)) return sum;
      if (!session.endedAt || session.endedAt < startAt) return sum;
      return sum + (session.focusedMs || 0);
    }, 0);

  const weekMs = sumFocusedMs(weekStart);
  const monthMs = sumFocusedMs(monthStart);
  const weekDays = Math.max(1, Math.ceil((currentTime - weekStart + 1) / dayMs));
  const monthDays = Math.max(1, Math.ceil((currentTime - monthStart + 1) / dayMs));

  return {
    weekHours: weekMs / (1000 * 60 * 60),
    monthHours: monthMs / (1000 * 60 * 60),
    weekAverageHours: weekMs / (1000 * 60 * 60) / weekDays,
    monthAverageHours: monthMs / (1000 * 60 * 60) / monthDays
  };
}
