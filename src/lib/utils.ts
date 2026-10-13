// Timer duration limits (shared between popup and tests)
export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 240;

// ── Tag normalization ──────────────────────────────────────────────

export function normalizeTagOption(tag: unknown): string {
  if (typeof tag !== "string") return "";
  return tag.trim().replace(/^#+/, "").replace(/\s+/g, "-").toLowerCase();
}

// ── Site / URL normalization ───────────────────────────────────────

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

// ── Timer display formatting ───────────────────────────────────────

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function parseEditedDurationMinutes(rawValue: string): number | null {
  const raw = rawValue.trim();
  if (!raw) return null;

  let minutes: number;

  if (/^\d+$/.test(raw)) {
    minutes = Number(raw);
  } else {
    const mmss = raw.match(/^(\d{1,3}):(\d{1,2})$/);
    if (!mmss) return null;

    const mm = Number(mmss[1]);
    const ss = Number(mmss[2]);
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss < 0 || ss > 59) return null;
    minutes = Math.round((mm * 60 + ss) / 60);
  }

  if (!Number.isFinite(minutes)) return null;
  return Math.max(MIN_DURATION_MINUTES, Math.min(MAX_DURATION_MINUTES, Math.round(minutes)));
}

// ── Duration text formatting (options / stats) ─────────────────────

export function toFocusText(totalMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(totalMs / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function toPerDayText(totalMs: number): string {
  const totalMinutes = Math.max(0, Math.round(totalMs / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h <= 0) return `${m}m/day`;
  if (m <= 0) return `${h}h/day`;
  return `${h}h ${m}m/day`;
}
