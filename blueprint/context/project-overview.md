# Focus Timer - Project Overview

<!-- blueprint:source-hash 9e3e2d6ec3e0c3f1c354f1f88504346e59c55de236eb242a8bcf9133903dabbf -->

> Lightweight Chrome extension for running focus sessions, tracking working time, and reducing distraction with optional site controls.

## Problem

The project addresses the common problem of losing focus while working in the browser. It gives users a simple timer, session context, and distraction controls so deep work can be started quickly and reviewed later without adding a separate productivity system.

## Users

- Individual knowledge workers who need a minimal focus timer while they work in a browser.
- Students and self-directed learners who want to group study time by topic and review totals.
- Users who prefer a personal, local-first productivity tool rather than a multi-user SaaS platform.

## Usage model

- Personal or small-team usage, not currently built for multi-tenant operations.
- Local-first extension behavior with optional Google sign-in and Firebase sync for cloud continuity.
- User-controlled storage, site policy lists, and account sync; no server-side authorization model beyond Firebase auth.
- No explicit compliance or enterprise requirements are defined in the current plan.
- The product is currently described as a personal utility extension rather than a broad SaaS offering.

## Features

The project is already shipped through the current feature set, and the remaining work is focused on packaging and release readiness.

1. **Focus timer workflow** - Starts, pauses, resets, and edits a focus countdown directly from the popup.
2. **Session tagging and context** - Saves tags alongside sessions so work can be separated by subject or project.
3. **Daily, weekly, and monthly totals** - Tracks focus totals and averages across reporting periods.
4. **Website allowlist and blocklist controls** - Restricts or permits specific sites while a focus session is active.
5. **Chrome extension lifecycle and settings** - Manages background alarms, storage state, offscreen audio, and settings configuration.
6. **Google auth and Firestore sync** - Adds optional sign-in and persistent session sync through Firebase.
7. **Production onboarding and publish setup** - Documents Firebase setup, extension packaging, and end-user installation steps.
8. **Release hardening** - Validates distribution readiness, OAuth configuration, and broader edge-case polish before wider rollout.

## Data model

### TimerState

- `status` (string) - one of `idle`, `running`, or `paused`
- `durationMs` (number) - configured countdown length in milliseconds
- `remainingMs` (number) - current remaining time for the active timer
- `startedAt` (number | null) - start time of the active run
- `lastTickAt` (number | null) - last visual or timer update timestamp

### Session

- `id` (string) - unique session identifier
- `startedAt` (number) - session start time
- `endedAt` (number) - session end time
- `focusedMs` (number) - number of milliseconds counted as productive work
- `tags` (string[]) - user-defined tags for the session
- `reason` (string) - optional reason or note on why the session happened
- `synced` (boolean) - whether the session has been synced to the cloud layer

### CurrentSession

- `id` (string) - active session id
- `startedAt` (number) - current session start time
- `focusedMs` (number) - current accumulated focus time for the active session
- `lastCommittedAt` (number | null) - last persisted checkpoint timestamp
- `tags` (string[]) - active tag list for the ongoing session

### Settings

- `defaultDurationMin` (number) - default timer length in minutes
- `breakDurationMin` (number) - break duration in minutes
- `endOfDayHour` (23 | 0 | 1 | 2 | 3 | 4) - cutover hour for daily tracking windows
- `endTimerSound` / `endBreakSound` (string) - sound selection for timer and break completion
- `toolbarDisplayMode` (string) - how the toolbar is displayed
- `tagOptions` (string[]) - valid tags available in the extension
- `blocklistSites` / `allowlistSites` (string[]) - normalized sites that are blocked or allowed
- `listMode` (string) - `blocklist` or `allowlist`

> The data model is intentionally local-first. Sessions and settings live in Chrome storage, while Google auth and Firestore can layer on top for optional syncing.

## Tech stack

- **Chrome extension MV3** - provides the browser integration and extension lifecycle.
- **TypeScript** - powers the popup, background worker, settings UI, and shared logic modules.
- **Chrome APIs** - handles storage, alarms, identity, tabs, and offscreen audio behaviors.
- **Firebase Authentication and Firestore** - support optional account sync and cross-device persistence.
- **Vitest** - validates the pure logic in the project, especially stats and formatting helpers.
- **TypeScript build pipeline** - emits runtime JavaScript into `src/gen` for the extension.

## Monetization

This project is not currently monetized. The current plan describes it as a free personal utility extension rather than a product with a paid tier or subscription model.

> TODO (confirm): confirm whether this remains a free utility or if any paid distribution path is planned later.

## UI/UX

- The primary experience is a compact popup timer for quick start and stop actions.
- The header surfaces daily focus totals and simple stats for fast review.
- The settings page is a utility surface for default durations, tag management, end-of-day windows, and blocking behavior.
- The experience favors low friction and a calm visual model over a full dashboard or multi-page app.

## Deployment

- **Target type**: Chrome browser extension
- **Development flow**: build the TypeScript sources, then load the unpacked extension in Chrome with Developer mode enabled.
- **Packaging path**: Chrome Web Store or enterprise-managed distribution path
- **Required config**: Firebase API key and project id in `src/config.ts` for optional sync
- **Storage**: Chrome local storage for core timer state and settings; Firebase Firestore for optional cloud sync
- **No production host**: the extension does not currently require a server-side web deployment for its core workflow

> TODO: confirm the final publish channel and the exact Firebase setup details for production distribution.

## Open questions

- > TODO (confirm): tighten the target user profile beyond individual knowledge workers.
- > TODO (confirm): decide whether the project remains a personal free extension or adopts a monetized distribution model later.
- > TODO (confirm): confirm whether the remaining roadmap items should stay as production onboarding and release hardening or be split into additional features.
- > TODO (confirm): finalize the exact Google OAuth and Firebase setup needed for first public distribution.
