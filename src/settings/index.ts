import { toFocusText, toPerDayText, normalizeWebsite } from "../lib/utils.js";
import {
  normalizeEndOfDayHour,
  getDayWindowStartMs,
  getSessionContributionMs
} from "../lib/stats.js";

const el = {
  defaultDuration: document.getElementById("default-duration") as HTMLInputElement | null,
  breakDuration: document.getElementById("break-duration") as HTMLInputElement | null,
  endOfDayHour: document.getElementById("end-of-day-hour") as HTMLSelectElement | null,
  endTimerSound: document.getElementById("end-timer-sound") as HTMLSelectElement | null,
  endBreakSound: document.getElementById("end-break-sound") as HTMLSelectElement | null,
  previewEndTimerSound: document.getElementById("preview-end-timer-sound") as HTMLButtonElement | null,
  previewEndBreakSound: document.getElementById("preview-end-break-sound") as HTMLButtonElement | null,
  toolbarDisplayMode: document.getElementById("toolbar-display-mode") as HTMLSelectElement | null,
  toolbarVisibleToggle: document.getElementById("toolbar-visible-toggle") as HTMLInputElement | null,
  blocklistInput: document.getElementById("blocklist-input") as HTMLInputElement | null,
  allowlistInput: document.getElementById("allowlist-input") as HTMLInputElement | null,
  blocklistSites: document.getElementById("blocklist-sites") as HTMLUListElement | null,
  allowlistSites: document.getElementById("allowlist-sites") as HTMLUListElement | null,
  statsWeekPrev: document.getElementById("stats-week-prev") as HTMLButtonElement | null,
  statsWeekNext: document.getElementById("stats-week-next") as HTMLButtonElement | null,
  statsWeekCurrent: document.getElementById("stats-week-current") as HTMLButtonElement | null,
  statsExcludeWeekends: document.getElementById("stats-exclude-weekends") as HTMLInputElement | null,
  statsWeekRange: document.getElementById("stats-week-range"),
  sevenDayAverage: document.getElementById("seven-day-average"),
  sevenDayChart: document.getElementById("seven-day-chart"),
  navLinks: Array.from(document.querySelectorAll(".nav-link")) as HTMLButtonElement[],
  sections: Array.from(document.querySelectorAll(".section-card")) as HTMLElement[]
};

type SettingsState = {
  defaultDurationMin?: number;
  breakDurationMin?: number;
  endOfDayHour?: 23 | 0 | 1 | 2 | 3 | 4;
  endTimerSound?: "none" | "bell1" | "bell2";
  endBreakSound?: "none" | "bell1" | "bell2";
  toolbarDisplayMode?: "icon" | "time" | "progress";
  blocklistSites?: string[];
  allowlistSites?: string[];
};

type PublicState = {
  timer?: {
    status?: string;
    startedAt?: number | null;
  };
  currentSession?: {
    startedAt?: number;
    focusedMs?: number;
    lastCommittedAt?: number;
  } | null;
  sessions?: Array<{ startedAt?: number; endedAt?: number; focusedMs?: number }>;
  settings?: SettingsState;
};

function normalizeUiSound(value: unknown, fallback: "bell1" | "bell2"): "none" | "bell1" | "bell2" {
  if (value === "none" || value === "bell1" || value === "bell2") {
    return value;
  }

  if (value === "chime") {
    return "bell1";
  }

  if (value === "bell") {
    return "bell2";
  }

  return fallback;
}

type MessageResponse = {
  ok: boolean;
  error?: string;
  state?: PublicState;
};

let blocklistSitesState: string[] = [];
let allowlistSitesState: string[] = [];
let lastActiveToolbarMode: "time" | "progress" = "time";
let activeWeekOffset = 0;
let latestState: PublicState | null = null;
let excludeWeekendsInStats = false;

function send(type: string, payload?: unknown): Promise<MessageResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response: MessageResponse | undefined) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Unknown error"));
        return;
      }

      resolve(response);
    });
  });
}

function startOfTodayMs(now = Date.now()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

function collectTodayMs(state: PublicState, now = Date.now()): number {
  const endOfDayHour = normalizeEndOfDayHour(state?.settings?.endOfDayHour);
  const startToday = getDayWindowStartMs(now, endOfDayHour);
  const sessions = Array.isArray(state?.sessions) ? state.sessions : [];

  let total = 0;
  for (const session of sessions) {
    total += getSessionContributionMs(session, startToday, now);
  }

  const current = state?.currentSession;
  if (current) {
    if (typeof current.lastCommittedAt === "number") {
      total += getSessionContributionMs(
        {
          startedAt: current.startedAt,
          endedAt: current.lastCommittedAt,
          focusedMs: current.focusedMs
        },
        startToday,
        now
      );
    }

    const timer = state?.timer;
    if (timer?.status === "running" && typeof timer.startedAt === "number") {
      total += getSessionContributionMs(
        {
          startedAt: timer.startedAt,
          endedAt: now,
          focusedMs: Math.max(0, now - timer.startedAt)
        },
        startToday,
        now
      );
    }
  }

  return total;
}

function toMinutesShort(totalMs: number): string {
  return toFocusText(totalMs);
}

type DailyPoint = {
  dayStart: number;
  dayOfWeek: number;
  label: string;
  totalMs: number;
  isToday: boolean;
};

type WeekPointsResult = {
  points: DailyPoint[];
  weekStart: number;
  weekEnd: number;
};

function getWeekStartMs(dayStart: number): number {
  const day = new Date(dayStart).getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return dayStart + diff * 24 * 60 * 60 * 1000;
}

function collectWeekMs(state: PublicState, weekOffset = 0, now = Date.now()): WeekPointsResult {
  const dayMs = 24 * 60 * 60 * 1000;
  const endOfDayHour = normalizeEndOfDayHour(state?.settings?.endOfDayHour);
  const todayStart = getDayWindowStartMs(now, endOfDayHour);
  const currentWeekStart = getWeekStartMs(todayStart);
  const weekStart = currentWeekStart + weekOffset * 7 * dayMs;
  const weekEnd = weekStart + 7 * dayMs;

  const points: DailyPoint[] = Array.from({ length: 7 }, (_, index) => {
    const dayStart = weekStart + index * dayMs;
    const dayDate = new Date(dayStart + dayMs / 2);

    return {
      dayStart,
      dayOfWeek: dayDate.getDay(),
      label: dayDate.toLocaleDateString(undefined, { weekday: "short" }),
      totalMs: 0,
      isToday: dayStart === todayStart
    };
  });

  const sessions = Array.isArray(state?.sessions) ? state.sessions : [];
  for (const session of sessions) {
    for (const point of points) {
      const dayStart = point.dayStart;
      const dayEnd = dayStart + dayMs;
      point.totalMs += getSessionContributionMs(session, dayStart, dayEnd);
    }
  }

  // Only project in-progress session time for the currently active calendar week.
  if (weekOffset === 0) {
    const current = state?.currentSession;
    if (current && typeof current.lastCommittedAt === "number") {
      for (const point of points) {
        const dayStart = point.dayStart;
        const dayEnd = dayStart + dayMs;
        point.totalMs += getSessionContributionMs(
          {
            startedAt: current.startedAt,
            endedAt: current.lastCommittedAt,
            focusedMs: current.focusedMs
          },
          dayStart,
          dayEnd
        );
      }
    }

    const timer = state?.timer;
    if (timer?.status === "running" && typeof timer.startedAt === "number") {
      for (const point of points) {
        const dayStart = point.dayStart;
        const dayEnd = dayStart + dayMs;
        point.totalMs += getSessionContributionMs(
          {
            startedAt: timer.startedAt,
            endedAt: now,
            focusedMs: Math.max(0, now - timer.startedAt)
          },
          dayStart,
          dayEnd
        );
      }
    }
  }

  return { points, weekStart, weekEnd };
}

function formatWeekRangeLabel(weekStart: number, weekEnd: number): string {
  const endDate = new Date(weekEnd - 1);
  const sameMonth = new Date(weekStart).getMonth() === endDate.getMonth();
  const startText = new Date(weekStart).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
  const endText = endDate.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : "short",
    day: "numeric"
  });

  return `${startText} - ${endText}`;
}

function renderSevenDayChart(points: DailyPoint[]): void {
  if (!el.sevenDayChart) return;

  const MIN_VISIBLE_BAR_MS = 60_000;
  const HALF_HOUR_MS = 30 * 60 * 1000;
  el.sevenDayChart.textContent = "";
  const maxMs = Math.max(0, ...points.map((point) => point.totalMs));
  const axisMaxMs = Math.max(HALF_HOUR_MS, Math.ceil(maxMs / HALF_HOUR_MS) * HALF_HOUR_MS);
  const axisSteps = Math.round(axisMaxMs / HALF_HOUR_MS);

  const axis = document.createElement("div");
  axis.className = "chart-axis";
  const guides = document.createElement("div");
  guides.className = "chart-guides";

  for (let step = axisSteps; step >= 0; step -= 1) {
    const hours = step * 0.5;
    const isHourly = Number.isInteger(hours);
    if (isHourly) {
      const axisLabel = document.createElement("span");
      axisLabel.className = "chart-axis-label hourly";
      axisLabel.textContent = `${hours}h`;
      axisLabel.style.bottom = `${(step / axisSteps) * 100}%`;
      axis.appendChild(axisLabel);
    }

    const guide = document.createElement("div");
    guide.className = `chart-guide${isHourly ? " hourly" : " half-hour"}`;
    guide.style.bottom = `${(step / axisSteps) * 100}%`;
    if (isHourly) {
      guides.appendChild(guide);
    }
  }

  const bars = document.createElement("div");
  bars.className = "chart-bars";
  bars.style.gridTemplateColumns = `repeat(${Math.max(1, points.length)}, minmax(0, 1fr))`;

  for (const point of points) {
    const col = document.createElement("div");
    col.className = `bar-col${point.isToday ? " today" : ""}`;

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    const rawPercent = Math.round((point.totalMs / axisMaxMs) * 100);
    const heightPercent = point.totalMs < MIN_VISIBLE_BAR_MS ? 0 : Math.max(2, rawPercent);
    fill.style.height = `${heightPercent}%`;
    fill.setAttribute("title", `${point.label}: ${toMinutesShort(point.totalMs)}`);

    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = point.label;

    track.appendChild(fill);
    col.append(track, label);
    bars.appendChild(col);
  }

  el.sevenDayChart.append(guides, axis, bars);
}

function renderForm(state: PublicState): void {
  const settings = state?.settings || {};
  if (el.defaultDuration) {
    el.defaultDuration.value = String(settings.defaultDurationMin || 25);
  }
  if (el.breakDuration) {
    el.breakDuration.value = String(settings.breakDurationMin || 5);
  }
  if (el.endOfDayHour) {
    el.endOfDayHour.value = String(normalizeEndOfDayHour(settings.endOfDayHour));
  }
  if (el.endTimerSound) {
    el.endTimerSound.value = normalizeUiSound(settings.endTimerSound, "bell1");
  }
  if (el.endBreakSound) {
    el.endBreakSound.value = normalizeUiSound(settings.endBreakSound, "bell2");
  }
  if (el.previewEndTimerSound) {
    el.previewEndTimerSound.disabled = (el.endTimerSound?.value || "none") === "none";
  }
  if (el.previewEndBreakSound) {
    el.previewEndBreakSound.disabled = (el.endBreakSound?.value || "none") === "none";
  }
  if (el.toolbarDisplayMode) {
    const mode = settings.toolbarDisplayMode || "icon";
    el.toolbarDisplayMode.value = mode;
    if (mode === "time" || mode === "progress") {
      lastActiveToolbarMode = mode;
    }
    if (el.toolbarVisibleToggle) {
      el.toolbarVisibleToggle.checked = mode !== "icon";
    }
  }

  blocklistSitesState = Array.isArray(settings.blocklistSites) ? [...settings.blocklistSites] : [];
  allowlistSitesState = Array.isArray(settings.allowlistSites) ? [...settings.allowlistSites] : [];
  renderSiteLists();
}

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}`;
}

function createSiteIconElement(site: string): HTMLElement {
  const icon = document.createElement("span");
  icon.className = "site-icon";
  icon.setAttribute("aria-hidden", "true");

  const img = document.createElement("img");
  img.src = getFaviconUrl(site);
  img.alt = "";
  img.className = "site-icon-img";

  // Fallback text if image fails to load
  const fallbackText = document.createElement("span");
  fallbackText.className = "site-icon-fallback";
  fallbackText.textContent = site.charAt(0).toUpperCase();

  img.addEventListener("error", () => {
    icon.classList.add("site-icon-fallback-active");
  });

  icon.append(img, fallbackText);
  return icon;
}

function renderSiteList(container: HTMLUListElement | null, sites: string[], emptyText: string): void {
  if (!container) return;

  container.textContent = "";

  if (!sites.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "site-item muted";

    const emptyTextNode = document.createElement("span");
    emptyTextNode.className = "site-domain";
    emptyTextNode.textContent = emptyText;

    emptyItem.appendChild(emptyTextNode);
    container.appendChild(emptyItem);
    return;
  }

  for (const site of sites) {
    const item = document.createElement("li");
    item.className = "site-item";
    item.dataset.site = site;

    const icon = createSiteIconElement(site);

    const domain = document.createElement("span");
    domain.className = "site-domain";
    domain.textContent = site;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-site-btn";
    removeBtn.type = "button";
    removeBtn.dataset.site = site;
    removeBtn.setAttribute("aria-label", `Remove ${site}`);
    removeBtn.title = `Remove ${site}`;
    removeBtn.textContent = "x";

    item.append(icon, domain, removeBtn);
    container.appendChild(item);
  }
}

function renderSiteLists(): void {
  renderSiteList(el.blocklistSites, blocklistSitesState, "No blocked websites yet");
  renderSiteList(el.allowlistSites, allowlistSitesState, "No allowed websites yet");
}

async function persistLists(): Promise<void> {
  const response = await send("UPDATE_SETTINGS", {
    blocklistSites: blocklistSitesState,
    allowlistSites: allowlistSitesState
  });

  if (response.state?.settings) {
    blocklistSitesState = Array.isArray(response.state.settings.blocklistSites)
      ? [...response.state.settings.blocklistSites]
      : blocklistSitesState;
    allowlistSitesState = Array.isArray(response.state.settings.allowlistSites)
      ? [...response.state.settings.allowlistSites]
      : allowlistSitesState;
    renderSiteLists();
  }
}

async function addSiteToList(which: "blocklist" | "allowlist", rawValue: string, inputEl: HTMLInputElement | null): Promise<void> {
  const site = normalizeWebsite(rawValue);
  if (!site) return;

  const target = which === "blocklist" ? blocklistSitesState : allowlistSitesState;
  if (target.includes(site)) return;

  if (inputEl) inputEl.value = "";

  target.push(site);
  target.sort((a, b) => a.localeCompare(b));
  renderSiteLists();
  await persistLists();
}

async function removeSiteFromList(which: "blocklist" | "allowlist", site: string): Promise<void> {
  const normalized = normalizeWebsite(site);
  if (!normalized) return;

  if (which === "blocklist") {
    blocklistSitesState = blocklistSitesState.filter((value) => value !== normalized);
  } else {
    allowlistSitesState = allowlistSitesState.filter((value) => value !== normalized);
  }

  renderSiteLists();
  await persistLists();
}

function renderStats(state: PublicState): void {
  const { points: weekPoints, weekStart, weekEnd } = collectWeekMs(state, activeWeekOffset);
  const visiblePoints = excludeWeekendsInStats
    ? weekPoints.filter((point) => point.dayOfWeek !== 0 && point.dayOfWeek !== 6)
    : weekPoints;
  const visibleDays = Math.max(1, visiblePoints.length);
  const sevenDayTotalMs = visiblePoints.reduce((sum, day) => sum + day.totalMs, 0);
  const sevenDayAverageMs = sevenDayTotalMs / visibleDays;

  if (el.sevenDayAverage) el.sevenDayAverage.textContent = toPerDayText(sevenDayAverageMs);
  if (el.statsWeekRange) el.statsWeekRange.textContent = formatWeekRangeLabel(weekStart, weekEnd);
  if (el.statsWeekNext) el.statsWeekNext.disabled = activeWeekOffset >= 0;
  if (el.statsWeekCurrent) el.statsWeekCurrent.disabled = activeWeekOffset === 0;

  renderSevenDayChart(visiblePoints);
}

function wireStatsNavigation(): void {
  el.statsWeekPrev?.addEventListener("click", () => {
    activeWeekOffset -= 1;
    if (latestState) {
      renderStats(latestState);
    }
  });

  el.statsWeekNext?.addEventListener("click", () => {
    if (activeWeekOffset >= 0) return;
    activeWeekOffset += 1;
    if (latestState) {
      renderStats(latestState);
    }
  });

  el.statsWeekCurrent?.addEventListener("click", () => {
    activeWeekOffset = 0;
    if (latestState) {
      renderStats(latestState);
    }
  });

  el.statsExcludeWeekends?.addEventListener("change", () => {
    excludeWeekendsInStats = !!el.statsExcludeWeekends?.checked;
    if (latestState) {
      renderStats(latestState);
    }
  });
}

async function autoSaveTimerSettings(): Promise<void> {
  const payload = {
    defaultDurationMin: Number(el.defaultDuration?.value || 25),
    breakDurationMin: Number(el.breakDuration?.value || 5),
    endOfDayHour: normalizeEndOfDayHour(el.endOfDayHour?.value),
    endTimerSound: el.endTimerSound?.value || "bell1",
    endBreakSound: el.endBreakSound?.value || "bell2",
    toolbarDisplayMode: el.toolbarDisplayMode?.value || "icon",
    blocklistSites: blocklistSitesState,
    allowlistSites: allowlistSitesState
  };

  try {
    const response = await send("UPDATE_SETTINGS", payload);
    if (response.state) {
      latestState = response.state;
      renderForm(response.state);
      renderStats(response.state);
    }
  } catch (error) {
    console.error(error);
  }
}

async function previewSound(sound: string): Promise<void> {
  if (sound === "none") return;

  try {
    await send("PREVIEW_SOUND", { sound });
  } catch (error) {
    console.error(error);
  }
}

function setActiveNav(targetId: string): void {
  for (const link of el.navLinks) {
    link.classList.toggle("active", link.dataset.target === targetId);
  }
}

function setActiveSection(targetId: string): void {
  for (const section of el.sections) {
    section.classList.toggle("hidden", section.id !== targetId);
  }
}

function activateTab(targetId: string): void {
  setActiveNav(targetId);
  setActiveSection(targetId);
  window.history.replaceState(null, "", `#${targetId}`);
}

function wireNavigation(): void {
  for (const link of el.navLinks) {
    link.addEventListener("click", () => {
      const targetId = link.dataset.target;
      if (!targetId) return;
      activateTab(targetId);
    });
  }
}

function wireSiteLists(): void {
  el.blocklistInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void addSiteToList("blocklist", el.blocklistInput?.value || "", el.blocklistInput);
  });

  el.allowlistInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void addSiteToList("allowlist", el.allowlistInput?.value || "", el.allowlistInput);
  });

  el.blocklistSites?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains("remove-site-btn")) return;
    const site = target.dataset.site;
    if (!site) return;
    void removeSiteFromList("blocklist", site);
  });

  el.allowlistSites?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains("remove-site-btn")) return;
    const site = target.dataset.site;
    if (!site) return;
    void removeSiteFromList("allowlist", site);
  });
}

function wireTimerFields(): void {
  el.defaultDuration?.addEventListener("change", () => void autoSaveTimerSettings());
  el.breakDuration?.addEventListener("change", () => void autoSaveTimerSettings());
  el.endOfDayHour?.addEventListener("change", () => void autoSaveTimerSettings());
  el.endTimerSound?.addEventListener("change", () => {
    if (el.previewEndTimerSound) {
      el.previewEndTimerSound.disabled = (el.endTimerSound?.value || "none") === "none";
    }
    void autoSaveTimerSettings();
  });
  el.endBreakSound?.addEventListener("change", () => {
    if (el.previewEndBreakSound) {
      el.previewEndBreakSound.disabled = (el.endBreakSound?.value || "none") === "none";
    }
    void autoSaveTimerSettings();
  });
  el.previewEndTimerSound?.addEventListener("click", () => {
    void previewSound(el.endTimerSound?.value || "none");
  });
  el.previewEndBreakSound?.addEventListener("click", () => {
    void previewSound(el.endBreakSound?.value || "none");
  });

  el.toolbarDisplayMode?.addEventListener("change", () => {
    const mode = el.toolbarDisplayMode?.value;
    if (mode === "time" || mode === "progress") {
      lastActiveToolbarMode = mode;
    }
    if (el.toolbarVisibleToggle) {
      el.toolbarVisibleToggle.checked = mode !== "icon";
    }
    void autoSaveTimerSettings();
  });

  el.toolbarVisibleToggle?.addEventListener("change", () => {
    if (!el.toolbarDisplayMode) return;

    if (el.toolbarVisibleToggle?.checked) {
      el.toolbarDisplayMode.value = lastActiveToolbarMode;
    } else {
      const mode = el.toolbarDisplayMode.value;
      if (mode === "time" || mode === "progress") {
        lastActiveToolbarMode = mode;
      }
      el.toolbarDisplayMode.value = "icon";
    }

    void autoSaveTimerSettings();
  });
}

async function init(): Promise<void> {
  wireNavigation();
  wireSiteLists();
  wireTimerFields();
  wireStatsNavigation();

  const response = await send("GET_STATE");
  if (response.state) {
    latestState = response.state;
    renderForm(response.state);
    renderStats(response.state);
  }

  const hashTarget = window.location.hash.replace("#", "");
  const defaultTarget = el.navLinks[0]?.dataset.target || "stats";
  const initialTarget = hashTarget && document.getElementById(hashTarget) ? hashTarget : defaultTarget;
  activateTab(initialTarget);
}

init().catch((error) => {
  console.error((error as Error).message || "Failed to load settings");
});
