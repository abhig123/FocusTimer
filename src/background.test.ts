import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StorageMap = Record<string, any>;

const makeChromeMock = (storage: StorageMap) => {
  const listeners: Array<
    (message: any, sender: any, sendResponse: (response: any) => void) => unknown
  > = [];

  const chromeMock = {
    storage: {
      local: {
        get: vi.fn(async (key: string | string[]) => {
          if (Array.isArray(key)) {
            const out: Record<string, any> = {};
            for (const item of key) out[item] = storage[item];
            return out;
          }
          return { [key]: storage[key] };
        }),
        set: vi.fn(async (record: Record<string, any>) => {
          Object.assign(storage, record);
        })
      }
    },
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      onMessage: {
        addListener: vi.fn((listener: any) => {
          listeners.push(listener);
        })
      },
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
      getContexts: vi.fn(async () => [])
    },
    alarms: {
      clear: vi.fn(async () => undefined),
      create: vi.fn(async () => undefined),
      onAlarm: {
        addListener: vi.fn()
      }
    },
    action: {
      setIcon: vi.fn(),
      setBadgeText: vi.fn(),
      setBadgeBackgroundColor: vi.fn()
    },
    tabs: {
      onUpdated: { addListener: vi.fn() },
      update: vi.fn(async () => undefined)
    },
    offscreen: {
      createDocument: vi.fn(async () => undefined),
      Reason: { AUDIO_PLAYBACK: "AUDIO_PLAYBACK" }
    },
    identity: {
      clearAllCachedAuthTokens: vi.fn(async () => undefined),
      getAuthToken: vi.fn(async () => "mock-token")
    }
  };

  return { chromeMock, listeners };
};

class MinimalOffscreenCanvas {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext() {
    return {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      clip: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fillRect: vi.fn(),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 0,
      lineCap: ""
    };
  }
}

describe("background timer controls", () => {
  let storage: StorageMap;
  let chromeMock: any;
  let onMessageListener: (message: any, sender: any, sendResponse: (response: any) => void) => unknown;

  const sendMessage = async (type: string, payload?: Record<string, any>) => {
    return await new Promise((resolve) => {
      onMessageListener({ type, payload }, {}, resolve);
    });
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T12:00:00Z"));
    vi.resetModules();

    storage = {};
    const setup = makeChromeMock(storage);
    chromeMock = setup.chromeMock;
    (globalThis as any).chrome = chromeMock;
    (globalThis as any).OffscreenCanvas = MinimalOffscreenCanvas;
    (globalThis as any).ImageData = class {};

    await import("./background.ts");

    onMessageListener = chromeMock.runtime.onMessage.addListener.mock.calls.at(-1)[0];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete (globalThis as any).chrome;
    delete (globalThis as any).OffscreenCanvas;
    delete (globalThis as any).ImageData;
  });

  it("enforces website rules through the tab listener and stops enforcing when paused", async () => {
    await sendMessage("UPDATE_SETTINGS", { blocklistSites: ["example.com"] });
    await sendMessage("START_TIMER", { durationMinutes: 25 });
    const onUpdated = chromeMock.tabs.onUpdated.addListener.mock.calls[0][0];

    onUpdated(42, { url: "https://example.com/path" }, {});
    await Promise.resolve();
    await Promise.resolve();
    expect(chromeMock.tabs.update).toHaveBeenCalledWith(42, {
      url: expect.stringContaining("src/features/blocking/blocked.html?")
    });

    chromeMock.tabs.update.mockClear();
    await sendMessage("PAUSE_TIMER");
    onUpdated(42, {}, { url: "https://example.com/path" });
    await Promise.resolve();
    await Promise.resolve();
    expect(chromeMock.tabs.update).not.toHaveBeenCalled();
  });

  it("plays the timer and starts a running session", async () => {
    const response = await sendMessage("START_TIMER", {
      tags: ["work", "study"],
      durationMinutes: 25
    });

    expect(response).toMatchObject({ ok: true });
    expect(storage.focusTimerData.timer.status).toBe("running");
    expect(storage.focusTimerData.currentSession).toMatchObject({
      tags: ["work", "study"]
    });
  });

  it("pauses a running timer and commits elapsed focus time", async () => {
    await sendMessage("START_TIMER", { tags: ["work"], durationMinutes: 25 });

    vi.setSystemTime(new Date("2025-01-01T12:05:00Z"));

    const response = await sendMessage("PAUSE_TIMER");

    expect(response).toMatchObject({ ok: true });
    expect(storage.focusTimerData.timer.status).toBe("paused");
    expect(storage.focusTimerData.currentSession.focusedMs).toBe(5 * 60 * 1000);
  });

  it("resumes a paused timer without losing the focus total", async () => {
    await sendMessage("START_TIMER", { tags: ["reading"], durationMinutes: 25 });

    vi.setSystemTime(new Date("2025-01-01T12:05:00Z"));
    await sendMessage("PAUSE_TIMER");

    vi.setSystemTime(new Date("2025-01-01T12:10:00Z"));
    const response = await sendMessage("RESUME_TIMER");

    expect(response).toMatchObject({ ok: true });
    expect(storage.focusTimerData.timer.status).toBe("running");
    expect(storage.focusTimerData.currentSession).toMatchObject({
      tags: ["reading"],
      focusedMs: 5 * 60 * 1000
    });
  });

  it("resets the timer and saves the completed session", async () => {
    await sendMessage("START_TIMER", { tags: ["work", "study"], durationMinutes: 25 });

    vi.setSystemTime(new Date("2025-01-01T12:12:00Z"));

    const response = await sendMessage("RESET_TIMER");

    expect(response).toMatchObject({ ok: true });
    expect(storage.focusTimerData.timer.status).toBe("idle");
    expect(storage.focusTimerData.currentSession).toBeNull();
    expect(storage.focusTimerData.sessions).toHaveLength(1);
    expect(storage.focusTimerData.sessions[0]).toMatchObject({
      focusedMs: 12 * 60 * 1000,
      tags: ["work", "study"]
    });
  });
});
