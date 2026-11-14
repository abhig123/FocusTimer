import { describe, expect, it, vi } from "vitest";
import { createBlockingSettings } from "./settings.js";

function setup() {
  const listeners = new Map<string, (event: { key: string; preventDefault: () => void }) => void>();
  const input = {
    value: "",
    addEventListener: (type: string, listener: (event: { key: string; preventDefault: () => void }) => void) => listeners.set(type, listener)
  };
  const send = vi.fn(async () => ({}));
  const controller = createBlockingSettings({
    blocklistInput: input as unknown as HTMLInputElement,
    allowlistInput: null,
    blocklistSites: null,
    allowlistSites: null
  }, send);
  controller.wireSiteLists();
  const enter = () => listeners.get("keydown")!({ key: "Enter", preventDefault: vi.fn() });
  return { controller, input, send, enter, listeners };
}

describe("blocking settings controller", () => {
  it("copies loaded lists and returns independent snapshots", () => {
    const { controller } = setup();
    const source = { blocklistSites: ["example.com"], allowlistSites: ["work.com"] };
    controller.setLists(source);
    source.blocklistSites.push("other.com");
    controller.getLists().allowlistSites.push("other.com");
    expect(controller.getLists()).toEqual({ blocklistSites: ["example.com"], allowlistSites: ["work.com"] });
    controller.setLists({});
    expect(controller.getLists()).toEqual({ blocklistSites: [], allowlistSites: [] });
  });

  it("normalizes additions, sorts the list, and keeps the existing message contract", async () => {
    const { controller, input, send, enter } = setup();
    controller.setLists({ blocklistSites: ["zebra.com"], allowlistSites: ["work.com"] });
    input.value = "https://www.example.com/path";
    enter();
    expect(input.value).toBe("");
    expect(send).toHaveBeenCalledWith("UPDATE_SETTINGS", {
      blocklistSites: ["example.com", "zebra.com"], allowlistSites: ["work.com"]
    });
    await Promise.resolve();
    expect(controller.getLists().blocklistSites).toEqual(["example.com", "zebra.com"]);
  });

  it("ignores duplicate, invalid, and non-Enter input", () => {
    const { controller, input, send, enter, listeners } = setup();
    controller.setLists({ blocklistSites: ["example.com"] });
    input.value = "https://www.example.com";
    enter();
    input.value = "localhost";
    enter();
    input.value = "other.com";
    listeners.get("keydown")!({ key: "Escape", preventDefault: vi.fn() });
    expect(send).not.toHaveBeenCalled();
    expect(controller.getLists().blocklistSites).toEqual(["example.com"]);
  });

  it("reconciles lists with the background response", async () => {
    const { controller, input, send, enter } = setup();
    send.mockResolvedValueOnce({ state: { settings: { blocklistSites: ["saved.com"], allowlistSites: ["work.com"] } } });
    input.value = "example.com";
    enter();
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getLists()).toEqual({ blocklistSites: ["saved.com"], allowlistSites: ["work.com"] });
  });
});
