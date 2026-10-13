# Coding Standards

This project is a Chrome extension written in TypeScript. The conventions below match the repository as it exists today rather than a generic template.

## TypeScript

- Strict mode is enabled in the TypeScript config.
- Prefer explicit interfaces for extension state, session data, and settings payloads.
- Avoid `any`; use narrow types or `unknown` when runtime data is uncertain.
- Keep business logic in pure helper modules under `src/lib` and let popup/background code orchestrate the browser APIs.

## Browser extension conventions

- Treat `chrome.storage.local`, `chrome.runtime`, `chrome.tabs`, `chrome.identity`, and `chrome.offscreen` as the product boundary.
- Keep DOM access and user interaction in the popup or settings entry points.
- Keep background behavior centralized in `src/background.ts` and use generated output under `src/gen` for runtime JS.
- Normalize and sanitize user-provided values before they are saved, especially tags and website entries.

## File organization

- Entry points: `src/*.ts` and `src/*.html`
- Shared logic: `src/lib/*.ts`
- Settings UI: `src/settings/*`
- Generated runtime files: `src/gen/*`
- Do not hand-edit generated JS in `src/gen`; regenerate it with the TypeScript build.

## Naming

- Functions and variables: camelCase
- Types and interfaces: PascalCase
- Constants with fixed values: UPPER_SNAKE_CASE
- Files: kebab-case or aligned with the module purpose, such as `stats.ts`, `utils.ts`, `background.ts`

## Styling

- Use plain CSS files in the extension source tree, not framework-specific styling.
- Keep CSS scoped to the feature or page it serves.
- Favor small, readable rules over broad abstraction for a lightweight extension UI.

## Data and persistence

- Session and settings state live in Chrome local storage and are read by the popup/background logic.
- Optional Google auth and Firestore sync are layered on top of that local-first design.
- Prefer the existing normalization helpers in `src/lib` when storing tags, websites, or durations.

## Testing

This repository already has a working Vitest setup and a real test command.

- Run tests with `npm run test`
- Run the full validation command with `npm run test && npm run build`
- Put pure logic tests next to the source under `src/lib/*.test.ts`
- Test deterministic logic and edge cases rather than browser UI flows or extension chrome behavior
- Keep the suite focused on data transformation, normalization, and time-window arithmetic, which are the logic-heavy areas in this codebase

## Code quality

- Remove unused imports and variables
- Keep functions small and readable
- Do not keep commented-out code in place unless it documents a temporary migration or a required compatibility workaround

## Comments

Write code that explains itself; comment only what the code cannot say.

- Comment the why, not the what
- Prefer self-documenting names and short functions over explanatory comments
- Avoid banner comments, section labels, or repeated narration of obvious code
- Keep doc comments minimal and only add them when they capture a non-obvious decision or compatibility caveat

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages, READMEs, specs.
- Use a hyphen for `term - description` separators; rephrase prose with commas, parentheses, or a colon.
- Avoid en dashes and the ellipsis character too.
