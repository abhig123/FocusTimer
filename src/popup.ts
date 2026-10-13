import { formatDuration, parseEditedDurationMinutes, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES } from "./lib/utils.js";
import {
  normalizeEndOfDayHour,
  getDayWindowStartMs,
  getSessionContributionMs
} from "./lib/stats.js";

const el = {
  remaining: document.getElementById("remaining"),
  play: document.getElementById("play"),
  pause: document.getElementById("pause"),
  reset: document.getElementById("reset"),
  decreaseDuration: document.getElementById("decrease-duration"),
  increaseDuration: document.getElementById("increase-duration"),
  timerEditor: document.getElementById("timer-editor"),
  tagPicker: document.getElementById("tag-picker"),
  settings: document.getElementById("settings"),
  headerFocus: document.getElementById("header-focus"),
  modeToggle: document.getElementById("mode-toggle"),
  progressRingFill: document.getElementById("progress-ring-fill")
};

const DURATION_STEP_MINUTES = 10;
const STATE_POLL_INTERVAL_MS = 60 * 1000;
const UI_TICK_INTERVAL_MS = 1000;
type TimerStatus = "idle" | "running" | "paused";

type PopupState = {
  timer: {
    status: TimerStatus;
    durationMs: number;
    remainingMs: number;
    startedAt: number | null;
  };
  sessions: Array<{ startedAt?: number; endedAt?: number; focusedMs?: number }>;
  currentSession: {
    startedAt?: number;
    focusedMs?: number;
    lastCommittedAt?: number;
    tags?: string[];
  } | null;
  settings?: {
    tagOptions?: string[];
    listMode?: ListMode;
    endOfDayHour?: 23 | 0 | 1 | 2 | 3 | 4;
  };
};

type ListMode = "blocklist" | "allowlist";

let appState: PopupState | null = null;
let refreshTimer: number | null = null;
let uiTickTimer: number | null = null;
let selectedTag: string | null = null;
let tagOptions = ["work", "study", "reading", "writing", "coding"];
let listMode: ListMode = "blocklist";
let isEditingDuration = false;
let lastStateSyncAt = 0;

function getModeLabel(mode: ListMode) {
  return mode === "allowlist" ? "Allowlist mode" : "Blocklist mode";
}

function getModeHint(mode: ListMode) {
  return mode === "allowlist"
    ? "Allowlist mode enabled (Tap to switch to Blocklist mode)"
    : "Blocklist mode enabled (Tap to switch to Allowlist mode)";
}

function renderMode(mode: ListMode) {
  if (el.modeToggle) {
    el.modeToggle.textContent = getModeLabel(mode);
    el.modeToggle.setAttribute("aria-label", `${getModeLabel(mode)}. Tap to switch`);
    el.modeToggle.setAttribute("title", getModeHint(mode));
  }
}

function formatTagChip(tag: string | null) {
  return tag ? `#${tag}` : "#no-tag";
}

function renderTagChip(tag: string | null) {
  if (!el.tagPicker) return;
  el.tagPicker.textContent = formatTagChip(tag);
  el.tagPicker.setAttribute("title", tag ? `Selected tag: #${tag}` : "Select tag");
}

function normalizeTag(tagInput: string | null) {
  if (!tagInput) return null;
  const normalized = tagInput.trim().replace(/^#+/, "").replace(/\s+/g, "-").toLowerCase();
  return normalized || null;
}

function formatFocusedMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function getTodayFocusedMs(state: PopupState | null, now = Date.now()) {
  if (!state) return 0;

  const endOfDayHour = normalizeEndOfDayHour(state.settings?.endOfDayHour);
  const startOfToday = getDayWindowStartMs(now, endOfDayHour);
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];

  let totalMs = 0;
  for (const session of sessions) {
    totalMs += getSessionContributionMs(session, startOfToday, now);
  }

  const current = state.currentSession;
  if (current) {
    const lastCommittedAt = Number(current.lastCommittedAt);

    if (Number.isFinite(lastCommittedAt)) {
      totalMs += getSessionContributionMs(
        {
          startedAt: current.startedAt,
          endedAt: lastCommittedAt,
          focusedMs: current.focusedMs
        },
        startOfToday,
        now
      );
    }

    const timer = state.timer;
    if (timer?.status === "running" && typeof timer.startedAt === "number") {
      totalMs += getSessionContributionMs(
        {
          startedAt: timer.startedAt,
          endedAt: now,
          focusedMs: Math.max(0, now - timer.startedAt)
        },
        startOfToday,
        now
      );
    }
  }

  return totalMs;
}

function renderTodayFocus(state: PopupState | null) {
  if (!el.headerFocus) return;
  const totalMs = getTodayFocusedMs(state);
  const totalMinutes = Math.floor(totalMs / 60000);
  const focusedText = formatFocusedMinutes(totalMinutes);
  el.headerFocus.textContent = focusedText;
  el.headerFocus.setAttribute("title", `Today focus: ${focusedText}. Click to view stats`);
  el.headerFocus.setAttribute("aria-label", `Today focus ${focusedText}. Open stats`);
}


function showDurationEditor(currentMinutes: number) {
  if (!el.remaining || !el.timerEditor) return;
  const timerEditor = el.timerEditor as HTMLInputElement;

  isEditingDuration = true;
  timerEditor.value = String(currentMinutes);
  el.remaining.classList.add("hidden");
  timerEditor.classList.remove("hidden");
  timerEditor.focus();
  timerEditor.select();
}

function hideDurationEditor() {
  if (!el.remaining || !el.timerEditor) return;

  isEditingDuration = false;
  el.timerEditor.classList.add("hidden");
  el.remaining.classList.remove("hidden");
}

function startDurationEdit() {
  if (!appState || appState.timer.status !== "idle" || !el.timerEditor) return;
  const currentMinutes = Math.round((appState.timer.durationMs || 25 * 60 * 1000) / 60000);
  showDurationEditor(currentMinutes);
}

function cancelDurationEdit() {
  if (!isEditingDuration) return;
  hideDurationEditor();
  if (appState) {
    renderTimer(appState);
  }
}

async function commitDurationEdit() {
  if (!isEditingDuration || !el.timerEditor || !appState) return;

  const nextMinutes = parseEditedDurationMinutes((el.timerEditor as HTMLInputElement).value);
  hideDurationEditor();

  if (nextMinutes === null) {
    renderTimer(appState);
    return;
  }

  const currentMinutes = Math.round((appState.timer.durationMs || 25 * 60 * 1000) / 60000);
  if (currentMinutes === nextMinutes) {
    renderTimer(appState);
    return;
  }

  try {
    const response = await send<{ state: PopupState }>("SET_TIMER_DURATION", {
      durationMinutes: nextMinutes
    });
    render(response.state);
  } catch (error) {
    console.error(error);
    renderTimer(appState);
  }
}

function getDisplayRemainingMs(state: PopupState, now = Date.now()) {
  const timer = state.timer;
  if (timer.status !== "running") {
    return Math.max(0, timer.remainingMs);
  }

  const elapsedSinceSync = Math.max(0, now - lastStateSyncAt);
  return Math.max(0, timer.remainingMs - elapsedSinceSync);
}

function renderTimer(state: PopupState) {
  const timer = state.timer;
  const displayRemainingMs = getDisplayRemainingMs(state);
  if (!el.remaining || !el.play || !el.pause || !el.reset) return;

  if (timer.status !== "idle" && isEditingDuration) {
    hideDurationEditor();
  }

  if (!isEditingDuration) {
    el.remaining.textContent = formatDuration(displayRemainingMs);
  }

  el.remaining.setAttribute(
    "title",
    timer.status === "idle"
      ? "Click to edit timer duration"
      : "Timer duration can only be edited while idle"
  );

  const isIdle = timer.status === "idle";
  const isRunning = timer.status === "running";
  const isPaused = timer.status === "paused";

  el.play.classList.toggle("hidden", isRunning);
  el.pause.classList.toggle("hidden", !isRunning);
  el.reset.classList.remove("hidden");

  if (isPaused) {
    el.play.setAttribute("aria-label", "Resume");
    el.play.setAttribute("title", "Resume");
  } else {
    el.play.setAttribute("aria-label", "Play");
    el.play.setAttribute("title", "Play");
  }

  (el.play as HTMLButtonElement).disabled = false;
  (el.pause as HTMLButtonElement).disabled = false;
  (el.reset as HTMLButtonElement).disabled = isIdle;

  if (el.progressRingFill) {
    const r = 88;
    const circumference = 2 * Math.PI * r;
    const fraction = timer.durationMs > 0 ? displayRemainingMs / timer.durationMs : 1;
    const clampedFraction = Math.max(0, Math.min(1, fraction));
    const offset = circumference * (1 - clampedFraction);
    (el.progressRingFill as unknown as SVGCircleElement).style.strokeDashoffset = String(offset);
  }

  const currentDurationMinutes = Math.round((timer.durationMs || 0) / 60000);
  const canEditDuration = isIdle && !isEditingDuration;

  if (el.decreaseDuration) {
    (el.decreaseDuration as HTMLButtonElement).disabled =
      !canEditDuration || currentDurationMinutes <= MIN_DURATION_MINUTES;
  }

  if (el.increaseDuration) {
    (el.increaseDuration as HTMLButtonElement).disabled =
      !canEditDuration || currentDurationMinutes >= MAX_DURATION_MINUTES;
  }
}

async function adjustDuration(deltaMinutes: number) {
  try {
    if (!appState || appState.timer.status !== "idle") return;

    const currentMinutes = Math.round((appState.timer.durationMs || 25 * 60 * 1000) / 60000);
    const nextMinutes = Math.max(
      MIN_DURATION_MINUTES,
      Math.min(MAX_DURATION_MINUTES, currentMinutes + deltaMinutes)
    );

    if (nextMinutes === currentMinutes) return;

    const response = await send<{ state: PopupState }>("SET_TIMER_DURATION", {
      durationMinutes: nextMinutes
    });

    render(response.state);
  } catch (error) {
    console.error(error);
  }
}

function render(state: PopupState) {
  appState = state;
  lastStateSyncAt = Date.now();

  if (Array.isArray(state.settings?.tagOptions) && state.settings.tagOptions.length) {
    tagOptions = state.settings.tagOptions;
  }

  listMode = state.settings?.listMode === "allowlist" ? "allowlist" : "blocklist";

  const activeTag = state.currentSession?.tags?.[0] || selectedTag;
  selectedTag = activeTag || null;

  renderTimer(state);
  renderTagChip(selectedTag);
  renderTodayFocus(state);
  renderMode(listMode);

  // Update the toolbar icon in real-time when timer is running
  if (state.timer.status === "running") {
    send("UPDATE_ICON", {
      remainingMs: state.timer.remainingMs,
      durationMs: state.timer.durationMs
    }).catch(() => {
      // Silently fail if message can't be sent
    });
  }
}

function tickUi() {
  if (!appState) return;
  renderTimer(appState);
  renderTodayFocus(appState);
}

function send<T>(type: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Unknown error"));
        return;
      }

      resolve(response as T);
    });
  });
}

async function refreshState() {
  try {
    const response = await send<{ state: PopupState }>("GET_STATE");
    render(response.state);
  } catch (error) {
    console.error(error);
  }
}

async function playTimer() {
  try {
    if (!appState) return;

    const status = appState.timer.status;
    let response;

    if (status === "paused") {
      response = await send<{ state: PopupState }>("RESUME_TIMER");
    } else if (status === "idle") {
      const durationMinutes = Math.max(1, Math.round((appState.timer.durationMs || 25 * 60 * 1000) / (60 * 1000)));
      response = await send<{ state: PopupState }>("START_TIMER", { tags: selectedTag ? [selectedTag] : [], durationMinutes });
    } else {
      return;
    }

    render(response.state);
  } catch (error) {
    console.error(error);
  }
}

function chooseTag() {
  const optionsLabel = tagOptions.map((tag, index) => `${index + 1}. #${tag}`).join("\n");
  const input = window.prompt(
    `Pick a tag:\n${optionsLabel}\n\nType a number, a custom tag, or leave empty to clear.`,
    selectedTag || ""
  );

  if (input === null) return;

  const trimmed = input.trim();
  if (!trimmed) {
    selectedTag = null;
    renderTagChip(selectedTag);
    return;
  }

  const optionIndex = Number(trimmed);
  if (Number.isInteger(optionIndex) && optionIndex >= 1 && optionIndex <= tagOptions.length) {
    selectedTag = tagOptions[optionIndex - 1];
    renderTagChip(selectedTag);
    return;
  }

  selectedTag = normalizeTag(trimmed);
  renderTagChip(selectedTag);
}

async function pauseTimer() {
  try {
    const response = await send<{ state: PopupState }>("PAUSE_TIMER");
    render(response.state);
  } catch (error) {
    console.error(error);
  }
}

async function resetTimer() {
  try {
    const response = await send<{ state: PopupState }>("RESET_TIMER");
    render(response.state);
  } catch (error) {
    console.error(error);
  }
}

async function toggleListMode() {
  try {
    const nextMode: ListMode = listMode === "blocklist" ? "allowlist" : "blocklist";
    listMode = nextMode;
    renderMode(listMode);
    const response = await send<{ state: PopupState }>("UPDATE_SETTINGS", { listMode: nextMode });
    render(response.state);
  } catch (error) {
    console.error(error);
    if (appState) {
      listMode = appState.settings?.listMode === "allowlist" ? "allowlist" : "blocklist";
      renderMode(listMode);
    }
  }
}

function openSettings() {
  chrome.runtime.openOptionsPage();
  window.close();
}

function openStats() {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/settings/index.html#stats") });
  window.close();
}

function wireEvents() {
  if (!el.play || !el.pause || !el.reset || !el.settings || !el.headerFocus || !el.modeToggle || !el.remaining) return;

  el.play.addEventListener("click", playTimer);
  el.pause.addEventListener("click", pauseTimer);
  el.reset.addEventListener("click", resetTimer);
  if (el.tagPicker) {
    el.tagPicker.addEventListener("click", chooseTag);
  }
  el.settings.addEventListener("click", openSettings);
  el.headerFocus.addEventListener("click", openStats);
  el.modeToggle.addEventListener("click", toggleListMode);
  el.decreaseDuration?.addEventListener("click", () => adjustDuration(-DURATION_STEP_MINUTES));
  el.increaseDuration?.addEventListener("click", () => adjustDuration(DURATION_STEP_MINUTES));
  el.remaining.addEventListener("click", startDurationEdit);
  el.remaining.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startDurationEdit();
    }
  });

  el.timerEditor?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitDurationEdit();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelDurationEdit();
    }
  });

  el.timerEditor?.addEventListener("blur", () => {
    void commitDurationEdit();
  });
}

async function init() {
  wireEvents();
  await refreshState();
  refreshTimer = window.setInterval(refreshState, STATE_POLL_INTERVAL_MS);
  uiTickTimer = window.setInterval(tickUi, UI_TICK_INTERVAL_MS);
}

window.addEventListener("beforeunload", () => {
  if (refreshTimer) clearInterval(refreshTimer);
  if (uiTickTimer) clearInterval(uiTickTimer);
});

init();
