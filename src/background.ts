import { firebaseConfig } from "./config.js";
import { createResetSessionRecord, getResetSessionEndedAt } from "./lib/stats.js";
import { normalizeTagOption, normalizeSiteEntry, normalizeSiteList } from "./lib/utils.js";

const DEFAULT_DURATION_MIN = 25;
const DEFAULT_BREAK_DURATION_MIN = 5;
const DEFAULT_END_OF_DAY_HOUR = 0;
const MIN_TIMER_DURATION_MIN = 1;
const MAX_TIMER_DURATION_MIN = 240;
const MIN_BREAK_DURATION_MIN = 1;
const MAX_BREAK_DURATION_MIN = 120;
const STORAGE_KEY = "focusTimerData";
const BLOCKED_PAGE_PATH = "src/blocked.html";
const OFFSCREEN_AUDIO_PATH = "src/offscreen.html";
const DEFAULT_TAG_OPTIONS = ["work", "study", "reading", "writing", "coding"];
const COMPLETE_ALARM_NAME = "focus-timer-complete";
const VISUAL_TICK_ALARM_NAME = "focus-timer-visual-tick";

let actionIconImageData: Record<number, ImageData> | null = null;

type TimerStatus = "idle" | "running" | "paused";

type TimerState = {
  status: TimerStatus;
  durationMs: number;
  remainingMs: number;
  startedAt: number | null;
  lastTickAt: number | null;
};

type Session = {
  id: string;
  startedAt: number;
  endedAt: number;
  focusedMs: number;
  actualDurationMs?: number;
  originalDurationMs?: number;
  tags: string[];
  reason: string;
  synced: boolean;
};

type CurrentSession = {
  id: string;
  startedAt: number;
  focusedMs: number;
  lastCommittedAt: number | null;
  tags: string[];
};

type UserInfo = {
  id: string;
  email?: string;
  name: string;
};

type ListMode = "blocklist" | "allowlist";
type SoundOption = "none" | "bell1" | "bell2";
type ToolbarDisplayMode = "icon" | "time" | "progress";

type Settings = {
  defaultDurationMin: number;
  breakDurationMin: number;
  endOfDayHour: 23 | 0 | 1 | 2 | 3 | 4;
  endTimerSound: SoundOption;
  endBreakSound: SoundOption;
  toolbarDisplayMode: ToolbarDisplayMode;
  tagOptions: string[];
  blocklistSites: string[];
  allowlistSites: string[];
  listMode: ListMode;
};

type AppState = {
  timer: TimerState;
  currentSession: CurrentSession | null;
  sessions: Session[];
  auth: {
    user: UserInfo | null;
    firebaseIdToken: string | null;
  };
  settings: Settings;
};

const state: AppState = {
  timer: {
    status: "idle",
    durationMs: DEFAULT_DURATION_MIN * 60 * 1000,
    remainingMs: DEFAULT_DURATION_MIN * 60 * 1000,
    startedAt: null,
    lastTickAt: null
  },
  currentSession: null,
  sessions: [],
  auth: {
    user: null,
    firebaseIdToken: null
  },
  settings: {
    defaultDurationMin: DEFAULT_DURATION_MIN,
    breakDurationMin: DEFAULT_BREAK_DURATION_MIN,
    endOfDayHour: DEFAULT_END_OF_DAY_HOUR,
    endTimerSound: "bell1",
    endBreakSound: "bell2",
    toolbarDisplayMode: "icon",
    tagOptions: [...DEFAULT_TAG_OPTIONS],
    blocklistSites: [],
    allowlistSites: [],
    listMode: "blocklist"
  }
};

const ready = loadState().then(async () => {
  updateBadge();
  // Restart visual tick interval if timer was running when extension loaded
  if (state.timer.status === "running") {
    await scheduleVisualTickAlarm();
  }
});

async function loadState() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  if (data[STORAGE_KEY]) {
    Object.assign(state, data[STORAGE_KEY]);
  }

  state.settings = normalizeSettings(state.settings);

  if (state.timer.status === "idle") {
    const configuredMs = state.settings.defaultDurationMin * 60 * 1000;
    state.timer.durationMs = configuredMs;
    state.timer.remainingMs = configuredMs;
  }
}


function normalizeSoundOption(value: unknown, fallback: SoundOption): SoundOption {
  if (value === "none" || value === "bell1" || value === "bell2") {
    return value;
  }

  // Keep older saved values working after sound option migration.
  if (value === "chime") {
    return "bell1";
  }

  if (value === "bell") {
    return "bell2";
  }

  return fallback;
}

function normalizeToolbarDisplayMode(
  value: unknown,
  fallback: ToolbarDisplayMode
): ToolbarDisplayMode {
  if (value === "icon" || value === "time" || value === "progress") {
    return value;
  }

  return fallback;
}

function normalizeEndOfDayHour(value: unknown, fallback: 23 | 0 | 1 | 2 | 3 | 4): 23 | 0 | 1 | 2 | 3 | 4 {
  const parsed = Number(value);
  if (parsed === 23 || parsed === 0 || parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4) {
    return parsed;
  }

  return fallback;
}

function normalizeSettings(rawSettings: Partial<Settings> | null | undefined): Settings {
  const incoming = rawSettings || {};

  const parsedDuration = Number(incoming.defaultDurationMin);
  const defaultDurationMin = Number.isFinite(parsedDuration)
    ? Math.max(MIN_TIMER_DURATION_MIN, Math.min(MAX_TIMER_DURATION_MIN, Math.round(parsedDuration)))
    : DEFAULT_DURATION_MIN;

  const parsedBreakDuration = Number(incoming.breakDurationMin);
  const breakDurationMin = Number.isFinite(parsedBreakDuration)
    ? Math.max(MIN_BREAK_DURATION_MIN, Math.min(MAX_BREAK_DURATION_MIN, Math.round(parsedBreakDuration)))
    : DEFAULT_BREAK_DURATION_MIN;

  const sourceTags = Array.isArray(incoming.tagOptions) ? incoming.tagOptions : DEFAULT_TAG_OPTIONS;
  const uniqueTags: string[] = [];
  const seen = new Set<string>();

  for (const rawTag of sourceTags) {
    const normalized = normalizeTagOption(rawTag);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    uniqueTags.push(normalized);
    if (uniqueTags.length >= 12) break;
  }

  const listMode = incoming.listMode === "allowlist" ? "allowlist" : "blocklist";
  const endOfDayHour = normalizeEndOfDayHour(incoming.endOfDayHour, DEFAULT_END_OF_DAY_HOUR);
  const endTimerSound = normalizeSoundOption(incoming.endTimerSound, "bell1");
  const endBreakSound = normalizeSoundOption(incoming.endBreakSound, "bell2");
  const toolbarDisplayMode = normalizeToolbarDisplayMode(incoming.toolbarDisplayMode, "icon");
  const blocklistSites = normalizeSiteList(incoming.blocklistSites);
  const allowlistSites = normalizeSiteList(incoming.allowlistSites);

  return {
    defaultDurationMin,
    breakDurationMin,
    endOfDayHour,
    endTimerSound,
    endBreakSound,
    toolbarDisplayMode,
    tagOptions: uniqueTags.length ? uniqueTags : [...DEFAULT_TAG_OPTIONS],
    blocklistSites,
    allowlistSites,
    listMode
  };
}

async function updateSettings(payload: Partial<Settings>) {
  const merged = {
    ...state.settings,
    ...(payload || {})
  };

  state.settings = normalizeSettings(merged);

  if (state.timer.status === "idle") {
    const configuredMs = state.settings.defaultDurationMin * 60 * 1000;
    state.timer.durationMs = configuredMs;
    state.timer.remainingMs = configuredMs;
  }

  await saveState();
  await scheduleVisualTickAlarm();
  updateBadge();
}

async function saveState() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function ensureOffscreenAudioDocument() {
  const runtime = chrome.runtime as typeof chrome.runtime & {
    getContexts?: (options: {
      contextTypes?: string[];
      documentUrls?: string[];
    }) => Promise<Array<{ contextType: string; documentUrl?: string }>>;
  };

  const offscreen = chrome.offscreen as typeof chrome.offscreen;
  if (!offscreen?.createDocument) {
    return false;
  }

  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_AUDIO_PATH);
  if (runtime.getContexts) {
    const existingContexts = await runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
      return true;
    }
  }

  try {
    await offscreen.createDocument({
      url: OFFSCREEN_AUDIO_PATH,
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "Play timer completion sounds when popup is closed"
    });
  } catch (error) {
    const message = (error as Error)?.message || "";
    if (!message.includes("Only a single offscreen document") && !message.includes("already exists")) {
      throw error;
    }
  }

  return true;
}

async function playSoundEffect(sound: SoundOption) {
  if (sound === "none") return;

  const hasOffscreenAudio = await ensureOffscreenAudioDocument();
  if (!hasOffscreenAudio) return;

  await chrome.runtime.sendMessage({
    type: "PLAY_SOUND",
    payload: { sound }
  });
}

function isHttpOrHttps(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function isBlockedPageUrl(url: string): boolean {
  return url.startsWith(chrome.runtime.getURL(BLOCKED_PAGE_PATH));
}

function hostnameMatchesSite(hostname: string, site: string): boolean {
  return hostname === site || hostname.endsWith(`.${site}`);
}

function isHostnameInList(hostname: string, sites: string[]): boolean {
  return sites.some((site) => hostnameMatchesSite(hostname, site));
}

function getNavigationBlockReason(url: string): "blocked" | "not-allowed" | null {
  if (state.timer.status !== "running") {
    return null;
  }

  if (!isHttpOrHttps(url) || isBlockedPageUrl(url)) return null;

  let hostname = "";
  try {
    hostname = normalizeSiteEntry(new URL(url).hostname);
  } catch {
    return null;
  }

  if (!hostname) return null;

  const { listMode, blocklistSites, allowlistSites } = state.settings;

  if (listMode === "blocklist") {
    return isHostnameInList(hostname, blocklistSites) ? "blocked" : null;
  }

  return isHostnameInList(hostname, allowlistSites) ? null : "not-allowed";
}

function buildBlockedPageUrl(reason: "blocked" | "not-allowed", originalUrl: string): string {
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

async function enforceWebsiteRules(tabId: number, url: string): Promise<void> {
  const reason = getNavigationBlockReason(url);
  if (!reason) return;

  const blockedPageUrl = buildBlockedPageUrl(reason, url);
  await chrome.tabs.update(tabId, { url: blockedPageUrl });
}

function formatUser(userInfo: { localId?: string; email?: string; displayName?: string }): UserInfo {
  return {
    id: userInfo.localId || "",
    email: userInfo.email,
    name: userInfo.displayName || userInfo.email || "Signed in"
  };
}

function ensureCurrentSession(tags?: string[]) {
  if (!state.currentSession) {
    state.currentSession = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      focusedMs: 0,
      lastCommittedAt: null,
      tags: tags || []
    };
  }

  if (Array.isArray(tags) && tags.length) {
    state.currentSession.tags = tags;
  }
}

function getNow() {
  return Date.now();
}

function getComputedRemainingMs(now = getNow()) {
  if (state.timer.status !== "running" || !state.timer.startedAt) {
    return Math.max(0, state.timer.remainingMs);
  }

  const elapsedSinceStart = now - state.timer.startedAt;
  return Math.max(0, state.timer.remainingMs - elapsedSinceStart);
}

function commitRunningChunk(now = getNow()) {
  if (state.timer.status !== "running" || !state.timer.startedAt) {
    return 0;
  }

  const chunkMs = Math.max(0, now - state.timer.startedAt);
  ensureCurrentSession();
  if (!state.currentSession) return 0;

  state.currentSession.focusedMs += chunkMs;
  state.currentSession.lastCommittedAt = now;

  const nextRemaining = Math.max(0, state.timer.remainingMs - chunkMs);
  state.timer.remainingMs = nextRemaining;
  state.timer.startedAt = null;
  state.timer.lastTickAt = now;

  return chunkMs;
}

function finalizeSession(reason: string, endedAtOverride?: number) {
  if (!state.currentSession || state.currentSession.focusedMs <= 0) {
    state.currentSession = null;
    return;
  }

  const endedAt = Number.isFinite(endedAtOverride)
    ? endedAtOverride!
    : getNow();

  state.sessions.push({
    id: state.currentSession.id,
    startedAt: state.currentSession.startedAt,
    endedAt,
    focusedMs: state.currentSession.focusedMs,
    tags: state.currentSession.tags || [],
    reason,
    synced: false
  });

  state.currentSession = null;
}

function resetTimerState() {
  state.timer.status = "idle";
  state.timer.startedAt = null;
  state.timer.lastTickAt = null;
  state.timer.remainingMs = state.timer.durationMs;
}

function drawBrandedIcon(
  ctx: OffscreenCanvasRenderingContext2D,
  size: number,
  options?: { showBorder?: boolean }
) {
  const center = size / 2;
  const radius = size * 0.46;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Light mint sky
  const skyGradient = ctx.createLinearGradient(0, 0, 0, size * 0.45);
  skyGradient.addColorStop(0, "#e8f5f0");
  skyGradient.addColorStop(1, "#d0ebe4");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, size, size);

  // Top mountain layer (lightest)
  ctx.fillStyle = "#a8d5c8";
  ctx.beginPath();
  ctx.moveTo(-size * 0.2, size * 0.42);
  ctx.quadraticCurveTo(size * 0.12, size * 0.32, size * 0.35, size * 0.38);
  ctx.quadraticCurveTo(size * 0.58, size * 0.28, size * 0.82, size * 0.36);
  ctx.quadraticCurveTo(size * 1.05, size * 0.42, size * 1.2, size * 0.38);
  ctx.lineTo(size * 1.2, size * 0.52);
  ctx.lineTo(-size * 0.2, size * 0.52);
  ctx.closePath();
  ctx.fill();

  // Middle mountain layer
  ctx.fillStyle = "#7fc4b0";
  ctx.beginPath();
  ctx.moveTo(-size * 0.15, size * 0.54);
  ctx.quadraticCurveTo(size * 0.08, size * 0.46, size * 0.32, size * 0.52);
  ctx.quadraticCurveTo(size * 0.62, size * 0.4, size * 0.88, size * 0.5);
  ctx.quadraticCurveTo(size * 1.1, size * 0.58, size * 1.15, size * 0.54);
  ctx.lineTo(size * 1.15, size * 0.7);
  ctx.lineTo(-size * 0.15, size * 0.7);
  ctx.closePath();
  ctx.fill();

  // Bottom mountain layer (darkest)
  ctx.fillStyle = "#5a9f8d";
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, size * 0.68);
  ctx.quadraticCurveTo(size * 0.15, size * 0.58, size * 0.4, size * 0.66);
  ctx.quadraticCurveTo(size * 0.7, size * 0.52, size * 0.95, size * 0.64);
  ctx.quadraticCurveTo(size * 1.08, size * 0.72, size * 1.1, size * 0.68);
  ctx.lineTo(size * 1.1, size * 1.1);
  ctx.lineTo(-size * 0.1, size * 1.1);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  const showBorder = options?.showBorder ?? true;
  if (showBorder) {
    // White stroke border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = Math.max(1.5, size * 0.07);
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function buildActionIconImageData(mode: ToolbarDisplayMode, remainingRatio = 1) {
  if (mode !== "progress" && actionIconImageData) {
    return actionIconImageData;
  }

  const sizes = [16, 32];
  const imageData: Record<number, ImageData> = {};

  for (const size of sizes) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    if (mode === "progress") {
      const center = size / 2;
      const radius = size * 0.38;
      const safeRemainingRatio = Math.max(0, Math.min(1, remainingRatio));
      const lineWidth = Math.max(2, size * 0.14);
      const innerRadius = Math.max(0, radius - lineWidth * 0.9);

      ctx.clearRect(0, 0, size, size);

      // Solid white center for high contrast on the Chrome toolbar.
      ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
      ctx.beginPath();
      ctx.arc(center, center, innerRadius, 0, Math.PI * 2);
      ctx.fill();

      // Full ring track represents elapsed part.
      ctx.strokeStyle = "rgba(218, 226, 236, 0.55)";
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.stroke();

      if (safeRemainingRatio > 0) {
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, "#22c55e");
        gradient.addColorStop(1, "#166534");
        ctx.strokeStyle = gradient;
        ctx.beginPath();
        ctx.arc(
          center,
          center,
          radius,
          -Math.PI / 2,
          -Math.PI / 2 - Math.PI * 2 * safeRemainingRatio,
          true
        );
        ctx.stroke();
      }
    } else {
      drawBrandedIcon(ctx, size, { showBorder: true });
    }

    imageData[size] = ctx.getImageData(0, 0, size, size);
  }

  if (mode !== "progress") {
    actionIconImageData = imageData;
    return actionIconImageData;
  }

  return imageData;
}

function applyActionIcon(mode: ToolbarDisplayMode, remainingMs: number, durationMs: number) {
  if (mode === "progress") {
    const safeDuration = Math.max(1, durationMs);
    const ratio = Math.max(0, Math.min(1, remainingMs / safeDuration));
    chrome.action.setIcon({ imageData: buildActionIconImageData("progress", ratio) });
    return;
  }

  chrome.action.setIcon({ imageData: buildActionIconImageData("icon") });
}

function formatBadgeMinutes(remainingMs: number): string {
  const minutes = Math.max(0, Math.ceil(remainingMs / (60 * 1000)));
  if (minutes > 99) return "99+";
  return `${Math.max(1, minutes)}m`;
}

function updateBadge(now = getNow()) {
  const mode = state.settings.toolbarDisplayMode || "icon";
  const remainingMs = getComputedRemainingMs(now);
  const text =
    mode === "time" && (state.timer.status === "running" || state.timer.status === "paused")
      ? formatBadgeMinutes(remainingMs)
      : "";

  // Keep a visible countdown indicator while timer is active, even if toolbar mode is icon-only.
  const iconMode: ToolbarDisplayMode =
    mode === "icon" && state.timer.status === "running" ? "progress" : mode;

  applyActionIcon(iconMode, remainingMs, state.timer.durationMs);

  chrome.action.setBadgeBackgroundColor({ color: "#1f2937" });
  chrome.action.setBadgeText({ text });
}

let visualTickInterval: number | null = null;

function startVisualTickInterval() {
  if (visualTickInterval !== null) {
    clearInterval(visualTickInterval);
  }

  if (state.timer.status !== "running") {
    return;
  }

  const mode = state.settings.toolbarDisplayMode || "icon";
  const shouldAnimate = mode === "time" || mode === "progress" || state.timer.status === "running";
  if (!shouldAnimate) {
    return;
  }

  visualTickInterval = globalThis.setInterval(() => {
    completeIfNeeded().catch(console.error);
    if (state.timer.status === "running") {
      updateBadge();
    }
  }, 250) as unknown as number;
}

function stopVisualTickInterval() {
  if (visualTickInterval !== null) {
    clearInterval(visualTickInterval);
    visualTickInterval = null;
  }
}

async function scheduleVisualTickAlarm() {
  await chrome.alarms.clear(VISUAL_TICK_ALARM_NAME);
  stopVisualTickInterval();

  if (state.timer.status !== "running") {
    return;
  }

  const mode = state.settings.toolbarDisplayMode || "icon";
  const shouldAnimate = mode === "time" || mode === "progress" || state.timer.status === "running";
  if (!shouldAnimate) {
    return;
  }

  startVisualTickInterval();

  await chrome.alarms.create(VISUAL_TICK_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: 1
  });
}

function getPublicState() {
  return {
    timer: {
      ...state.timer,
      remainingMs: getComputedRemainingMs()
    },
    currentSession: state.currentSession,
    sessions: state.sessions,
    auth: {
      user: state.auth.user
    },
    settings: state.settings
  };
}

async function scheduleCompletionAlarm() {
  const remainingMs = getComputedRemainingMs();
  await chrome.alarms.clear(COMPLETE_ALARM_NAME);

  if (state.timer.status !== "running" || remainingMs <= 0) {
    return;
  }

  await chrome.alarms.create(COMPLETE_ALARM_NAME, {
    when: Date.now() + remainingMs
  });
}

async function startTimer(payload: { tags?: string[]; durationMinutes?: number }) {
  const tags = payload?.tags || [];
  const durationMinutes = Number(payload?.durationMinutes);

  if (
    state.timer.status === "idle" &&
    Number.isFinite(durationMinutes) &&
    durationMinutes > 0
  ) {
    const safeMinutes = Math.max(
      MIN_TIMER_DURATION_MIN,
      Math.min(MAX_TIMER_DURATION_MIN, Math.round(durationMinutes))
    );
    state.settings.defaultDurationMin = safeMinutes;
    state.timer.durationMs = safeMinutes * 60 * 1000;
    state.timer.remainingMs = state.timer.durationMs;
  }

  ensureCurrentSession(tags);

  if (state.timer.status === "running") {
    return;
  }

  state.timer.status = "running";
  state.timer.startedAt = getNow();
  state.timer.lastTickAt = state.timer.startedAt;

  await saveState();
  await scheduleCompletionAlarm();
  await scheduleVisualTickAlarm();
  updateBadge();
}

async function setTimerDuration(durationMinutes: number) {
  if (!Number.isFinite(durationMinutes) || state.timer.status !== "idle") {
    return;
  }

  const safeMinutes = Math.max(
    MIN_TIMER_DURATION_MIN,
    Math.min(MAX_TIMER_DURATION_MIN, Math.round(durationMinutes))
  );

  state.timer.durationMs = safeMinutes * 60 * 1000;
  state.timer.remainingMs = state.timer.durationMs;
  state.settings.defaultDurationMin = safeMinutes;

  await saveState();
  updateBadge();
}

async function pauseTimer() {
  if (state.timer.status !== "running") return;

  commitRunningChunk();
  state.timer.status = "paused";

  await saveState();
  stopVisualTickInterval();
  await chrome.alarms.clear(COMPLETE_ALARM_NAME);
  await chrome.alarms.clear(VISUAL_TICK_ALARM_NAME);
  updateBadge();
}

async function resumeTimer() {
  if (state.timer.status !== "paused") return;

  state.timer.status = "running";
  state.timer.startedAt = getNow();
  state.timer.lastTickAt = state.timer.startedAt;

  await saveState();
  await scheduleCompletionAlarm();
  await scheduleVisualTickAlarm();
  updateBadge();
}

async function resetTimer() {
  if (state.currentSession) {
    const endedAt = getResetSessionEndedAt(state.currentSession);
    const record = createResetSessionRecord(
      state.currentSession,
      state.timer.durationMs,
      endedAt
    );

    state.sessions.push({
      id: record.id || state.currentSession.id,
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      focusedMs: record.focusedMs,
      actualDurationMs: record.actualDurationMs,
      originalDurationMs: record.originalDurationMs,
      tags: record.tags,
      reason: record.reason,
      synced: record.synced
    });
    state.currentSession = null;
  }

  resetTimerState();

  await saveState();
  stopVisualTickInterval();
  await chrome.alarms.clear(COMPLETE_ALARM_NAME);
  await chrome.alarms.clear(VISUAL_TICK_ALARM_NAME);
  updateBadge();
}

async function completeIfNeeded() {
  if (state.timer.status !== "running") return;

  const remaining = getComputedRemainingMs();
  if (remaining > 0) return;

  commitRunningChunk();
  finalizeSession("complete");
  resetTimerState();

  await saveState();
  stopVisualTickInterval();
  await chrome.alarms.clear(COMPLETE_ALARM_NAME);
  await chrome.alarms.clear(VISUAL_TICK_ALARM_NAME);
  updateBadge();

  await playSoundEffect(state.settings.endTimerSound).catch(() => {
    // Ignore playback errors to avoid interrupting timer completion flow.
  });
}

async function clearAllData() {
  state.sessions = [];
  state.currentSession = null;
  resetTimerState();
  await saveState();
  stopVisualTickInterval();
  await chrome.alarms.clear(COMPLETE_ALARM_NAME);
  await chrome.alarms.clear(VISUAL_TICK_ALARM_NAME);
  updateBadge();
}

async function getGoogleAccessToken() {
  const tokenResult = await chrome.identity.getAuthToken({ interactive: true });

  if (typeof tokenResult === "string") {
    return tokenResult;
  }

  if (tokenResult && typeof tokenResult === "object" && "token" in tokenResult && tokenResult.token) {
    return tokenResult.token;
  }

  throw new Error("Google auth token was not returned.");
}

async function signIn() {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_")) {
    throw new Error("Set Firebase config in src/config.ts before signing in.");
  }

  const accessToken = await getGoogleAccessToken();

  const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(
    firebaseConfig.apiKey
  )}`;

  const body = {
    postBody: `access_token=${encodeURIComponent(accessToken)}&providerId=google.com`,
    requestUri: `https://${chrome.runtime.id}.chromiumapp.org`,
    returnSecureToken: true,
    returnIdpCredential: true
  };

  const response = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Firebase sign-in failed: ${text}`);
  }

  const json = await response.json();
  state.auth.firebaseIdToken = json.idToken;
  state.auth.user = formatUser(json);
  await saveState();

  await syncUnsyncedSessions();

  return state.auth.user;
}

async function signOut() {
  try {
    await chrome.identity.clearAllCachedAuthTokens();
  } catch (_error) {
    // Ignore token cache errors because local sign-out should still proceed.
  }

  state.auth.user = null;
  state.auth.firebaseIdToken = null;
  await saveState();
}

function sessionToFirestoreDoc(session: Session) {
  return {
    fields: {
      id: { stringValue: session.id },
      startedAt: { integerValue: String(session.startedAt) },
      endedAt: { integerValue: String(session.endedAt) },
      focusedMs: { integerValue: String(session.focusedMs) },
      actualDurationMs: {
        integerValue: String(session.actualDurationMs ?? Math.max(0, session.endedAt - session.startedAt))
      },
      originalDurationMs: {
        integerValue: String(session.originalDurationMs ?? 0)
      },
      reason: { stringValue: session.reason || "" },
      tags: {
        arrayValue: {
          values: (session.tags || []).map((tag) => ({ stringValue: tag }))
        }
      }
    }
  };
}

async function syncUnsyncedSessions() {
  if (!state.auth.user || !state.auth.firebaseIdToken) {
    return { pushed: 0 };
  }

  const unsynced = state.sessions.filter((s) => !s.synced);
  if (!unsynced.length) return { pushed: 0 };

  const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/(default)/documents/users/${encodeURIComponent(
    state.auth.user.id
  )}/sessions`;

  for (const session of unsynced) {
    const url = `${root}/${encodeURIComponent(session.id)}`;
    const resp = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${state.auth.firebaseIdToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(sessionToFirestoreDoc(session))
    });

    if (resp.ok) {
      session.synced = true;
      continue;
    }

    const text = await resp.text();
    throw new Error(`Sync failed for session ${session.id}: ${text}`);
  }

  await saveState();
  return { pushed: unsynced.length };
}

async function fetchRemoteSessions() {
  if (!state.auth.user || !state.auth.firebaseIdToken) {
    return { pulled: 0 };
  }

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/(default)/documents/users/${encodeURIComponent(
    state.auth.user.id
  )}/sessions`;

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${state.auth.firebaseIdToken}`
    }
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Fetch remote sessions failed: ${text}`);
  }

  const json = await resp.json();
  const docs = json.documents || [];

  let pulled = 0;
  for (const doc of docs) {
    const f = doc.fields || {};
    const id = f.id?.stringValue;
    if (!id) continue;

    const exists = state.sessions.some((s) => s.id === id);
    if (exists) continue;

    state.sessions.push({
      id,
      startedAt: Number(f.startedAt?.integerValue || 0),
      endedAt: Number(f.endedAt?.integerValue || 0),
      focusedMs: Number(f.focusedMs?.integerValue || 0),
      reason: f.reason?.stringValue || "",
      tags: (f.tags?.arrayValue?.values || []).map((v: { stringValue: string }) => v.stringValue),
      synced: true
    });
    pulled += 1;
  }

  if (pulled > 0) {
    await saveState();
  }

  return { pulled };
}

chrome.runtime.onInstalled.addListener(async () => {
  await loadState();
  await scheduleCompletionAlarm();
  await scheduleVisualTickAlarm();
  updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await loadState();
  await scheduleCompletionAlarm();
  await scheduleVisualTickAlarm();
  updateBadge();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  if (!url) return;

  void ready.then(() => enforceWebsiteRules(tabId, url)).catch(() => {
    // Ignore background enforcement failures for individual navigation events.
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  await ready;

  if (alarm.name === COMPLETE_ALARM_NAME) {
    await completeIfNeeded();
    return;
  }

  if (alarm.name === VISUAL_TICK_ALARM_NAME) {
    await completeIfNeeded();
    if (state.timer.status === "running") {
      updateBadge();
    }
  }
});

type RuntimeMessage = {
  type?: string;
  payload?: { tags?: string[]; durationMinutes?: number; sound?: SoundOption } & Partial<Settings>;
};

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.type === "PLAY_SOUND") {
    // Offscreen document handles playback requests.
    return false;
  }

  (async () => {
    await ready;
    const type = message?.type;

    if (type === "PREVIEW_SOUND") {
      const sound = normalizeSoundOption(message.payload?.sound, "none");
      await playSoundEffect(sound);
      sendResponse({ ok: true });
      return;
    }

    if (type === "GET_STATE") {
      await completeIfNeeded();
      sendResponse({ ok: true, state: getPublicState() });
      return;
    }

    if (type === "START_TIMER") {
      await startTimer(message.payload || {});
      await completeIfNeeded();
      sendResponse({ ok: true, state: getPublicState() });
      return;
    }

    if (type === "PAUSE_TIMER") {
      await pauseTimer();
      sendResponse({ ok: true, state: getPublicState() });
      return;
    }

    if (type === "RESUME_TIMER") {
      await resumeTimer();
      await completeIfNeeded();
      sendResponse({ ok: true, state: getPublicState() });
      return;
    }

    if (type === "RESET_TIMER") {
      await resetTimer();
      sendResponse({ ok: true, state: getPublicState() });
      return;
    }

    if (type === "SET_TIMER_DURATION") {
      await setTimerDuration(Number(message.payload?.durationMinutes));
      sendResponse({ ok: true, state: getPublicState() });
      return;
    }

    if (type === "UPDATE_ICON") {
      const remainingMs = Number((message.payload as unknown as { remainingMs?: number })?.remainingMs) || 0;
      const durationMs = Number((message.payload as unknown as { durationMs?: number })?.durationMs) || 1;
      const mode = state.settings.toolbarDisplayMode || "icon";
      applyActionIcon(mode, remainingMs, durationMs);
      sendResponse({ ok: true });
      return;
    }

    if (type === "CLEAR_ALL") {
      await clearAllData();
      sendResponse({ ok: true, state: getPublicState() });
      return;
    }

    if (type === "SIGN_IN") {
      const user = await signIn();
      const pulled = await fetchRemoteSessions();
      sendResponse({ ok: true, user, pulled, state: getPublicState() });
      return;
    }

    if (type === "SIGN_OUT") {
      await signOut();
      sendResponse({ ok: true, state: getPublicState() });
      return;
    }

    if (type === "SYNC_NOW") {
      const pushed = await syncUnsyncedSessions();
      const pulled = await fetchRemoteSessions();
      sendResponse({ ok: true, pushed, pulled, state: getPublicState() });
      return;
    }

    if (type === "GET_SETTINGS") {
      sendResponse({ ok: true, settings: state.settings, state: getPublicState() });
      return;
    }

    if (type === "UPDATE_SETTINGS") {
      await updateSettings(message.payload || {});
      sendResponse({ ok: true, settings: state.settings, state: getPublicState() });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
  })().catch((error: Error) => {
    sendResponse({ ok: false, error: error.message || String(error) });
  });

  return true;
});
