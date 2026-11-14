import type { ListMode } from "./types.js";

export function getModeLabel(mode: ListMode) {
  return mode === "allowlist" ? "Allowlist mode" : "Blocklist mode";
}

export function getModeHint(mode: ListMode) {
  return mode === "allowlist"
    ? "Allowlist mode enabled (Tap to switch to Blocklist mode)"
    : "Blocklist mode enabled (Tap to switch to Allowlist mode)";
}

