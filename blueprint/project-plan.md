# Project Plan

## 1. Problem - What problem are we solving?

This app helps people protect their focus while working in the browser by combining a simple countdown timer with session tagging, daily totals, and optional site blocking. The main goal is to make deep-work sessions easy to start and easy to review without turning time tracking into a separate productivity platform.

## 2. Users - Who is this for?

The current project is aimed at individual knowledge workers, students, and self-directed learners who spend time in browser-based work and want a lightweight way to stay on task. The app is primarily a personal productivity tool for one user at a time. > TODO (confirm): tighten the target audience and expected user profile.

## 3. Features - What does the MVP need?

- A focused countdown timer with start, pause, reset, and duration editing.
- Per-session tags so work can be grouped by project, subject, or theme.
- Daily, weekly, and monthly total focus hours with averages for review.
- Optional site allowlist or blocklist controls to reduce distraction while the timer is active.
- Local session persistence with optional Google sign-in and Firestore sync for cross-device continuity.
- A settings surface for default duration, end-of-day cutoff, and extension behavior.

## 4. Data - What are we storing?

- Current timer state: remaining time, status, started time, and active session metadata.
- Saved sessions with start/end timestamps, focused_ms, tags, and reason or notes.
- Site allow/block rules normalized to hostnames.
- User profile metadata from Google auth and Firestore sync state.
- Extension settings: default duration, break duration, end-of-day cutoff, sound choices, list mode, and tag options.

## 5. Tech - What stack are we using?

- Chrome extension MV3
- TypeScript for app logic and UI logic
- Chrome extension APIs for storage, alarms, identity, tabs, and offscreen audio
- Firebase Authentication and Firestore for optional cloud sync
- Vitest for unit tests
- Generated runtime output is written to `src/gen` after a TypeScript build

## 6. Monetize - How will this make money?

There is no current monetization model in the codebase; this is a personal utility extension rather than a paid SaaS product. > TODO (confirm): confirm whether this stays a free side project or will be packaged for sale or distribution later.

## 7. UI/UX - How should this look and feel?

The extension is intended to feel lightweight and calm: a compact popup, one primary timer display, clear action buttons, and a minimal stats header that surfaces focus totals immediately. The settings page is a utility surface for configuration rather than a full app shell. The current design emphasizes low friction and fast task switching over heavy visual polish.

## 8. Deployment - Where and how will this ship?

This project ships as a Chrome browser extension, loaded unpacked during development and intended to be published through the Chrome Web Store or an enterprise-managed extension distribution path. It depends on local browser storage and optional Firebase config values in `src/config.ts`, which currently contain placeholders. There is no production web host or backend service required for core local use.

## 9. Usage model and constraints (optional)

- Expected user count: personal or small-team usage; not currently built for multi-tenant services.
- Operation style: local-first browser extension with optional cloud sync.
- Trust boundaries: local browser storage, signed-in account sync, and site list policies are user-controlled; the extension does not currently have a server-side authorization model beyond Firebase auth.
- Security/compliance: no explicit compliance requirements are encoded in the project today.
- Non-requirements: this is not a multi-user SaaS platform or a cross-platform desktop app. > TODO (confirm): confirm whether the product should stay a personal extension or grow into a broader multi-user offering.
