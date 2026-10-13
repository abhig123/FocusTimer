# Feature: Reset button ends the current session record without changing focus totals

**From build-plan:** feature 1
**Build attempt:** 1
**Branch:** feature/reset-button-timer-zero
**Status:** verified

## Goal

The popup reset button must end the active timer session record while leaving all focus totals unchanged. When the user presses reset, the timer should immediately move to zero, the current session should be closed in the session history, and no focus time should be counted toward today, yesterday, or any other totals.

The intended contract is:

- Idle state: reset button remains disabled.
- Running state: reset button is enabled.
- Paused state: reset button remains enabled.
- Reset action: the running or paused timer becomes zero immediately and the current session record is ended, but the elapsed focus time is not added to any totals.

## Design reference

The existing popup and timer state are defined in `src/popup.ts`, `src/popup.html`, and the background timer flow in `src/background.ts`. This behavior should fit the current session lifecycle and validation flow while preserving the current UI semantics.

## In scope

- Reset while the timer is running
- Reset while the timer is paused
- Ending the active session record when reset is pressed
- Recording session metadata such as start time, original duration, and session duration even though totals stay unchanged
- Ensuring totals remain unchanged for current, previous, and historical focus windows
- Preserving the existing idle/running/paused button-enable state rules

## Out of scope

- Play, pause, and resume behavior beyond the reset interaction
- Break timer logic or any different reset semantics for break periods
- Any change to how completed focus sessions are counted during normal timer completion
- New analytics/reporting views for reset sessions
- Firebase schema redesign unless the current storage path already supports the required record shape

## Build loop

This is a focused behavioral fix within the existing session lifecycle. It follows the current project settings:

- `workflow.stepReview`: `feature`
- `workflow.checkpointCommits`: `disabled`

The work should stay in one reviewable pass and be validated with the project’s real verification command before completion.

## Build steps

- [ ] 1. Trace the reset flow and session finalization path
  - Confirm where the app currently ends a session and how the reset state is persisted.
  - Identify the closest existing record format for storing a session’s start time, actual duration, and original configured duration.
  - Done when: the implementation path is clear and the reset behavior can be mapped to the existing local or synced session storage format.

- [ ] 2. Align reset behavior with the revised contract
  - Update the reset action so it closes the active session record and resets the timer to zero while leaving all aggregate totals unchanged.
  - Preserve the configured timer duration and restore the idle state after zeroing the timer.
  - Done when: a running or paused timer resets to zero, the session record is closed, and no focus time is added to stored totals for today or any other window.

- [ ] 3. Keep the popup state consistent with the session reset semantics
  - Ensure the reset button remains disabled when the timer is idle and enabled while running or paused.
  - Done when: the button state matches the timer state exactly before and after reset, without changing the larger popup behavior.

- [ ] 4. Add or tighten regression coverage for the reset contract
  - Add focused logic coverage for the reset session record and the unchanged totals behavior in the existing test suite.
  - Done when: the targeted tests pass and the project verification command remains green.

## Files / areas

- `src/popup.ts` - popup button state and reset click behavior
- `src/background.ts` - timer reset flow, current-session lifecycle, and session persistence
- `src/lib/stats.ts` - focus totals and time-window calculations that must stay unchanged by reset
- `src/lib/stats.test.ts` - targeted regression tests for reset-session and totals behavior
- `src/config.ts` - optional Firebase configuration for session persistence if the app uses the same existing storage path

## Data / contracts

- Reset must end the current session record.
- The session record should retain enough metadata to describe what happened, including at minimum:
  - `startedAt` for the session start time
  - `endedAt` for the reset moment
  - `durationMs` or equivalent actual elapsed session duration
  - `originalDurationMs` or equivalent configured timer duration
  - `tags` if the session was active and tagged
  - any existing reason or metadata already used by the current session model
- Reset must not add the elapsed session time to today’s focus totals, yesterday’s totals, or any aggregate totals.
- Reset must not mutate the current session’s focus total in the running stats model.
- After reset, the timer state should be equivalent to a fresh idle timer with `remainingMs` set to the configured duration and `startedAt` cleared.

## Testing

The project already declares a real verification command in `AGENTS.md`:

- `npm run test && npm run build`

This feature should be covered with a focused logic test if the implementation can be exercised without browser automation. There is no browser-test command configured in this repository, so browser automation is not required for this spec.

## Notes for the AI

The key decision here is that reset is not a silent clear. It is a session-ending event that should be persisted in the same current session record flow, but it must be excluded from focus totals. The implementation should therefore: close the session, save the metadata, and zero the timer without adding any time to aggregate focus windows.

This means the reset path should avoid the normal completion flow that increments focus totals, while still recording the session metadata using the existing persisted session model if that is the current storage path. If the repository already writes a session record for end-of-session events, reuse that mechanism rather than inventing a different format.

