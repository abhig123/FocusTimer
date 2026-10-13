# Focus Timer Chrome Extension

Simple Chrome extension with:
- Countdown focus timer (no breaks)
- Start, pause, reset
- Tags for sessions
- Weekly and monthly focused hours + daily averages
- Google sign-in and Firebase Firestore sync

## TypeScript setup

This project now uses TypeScript for source files and compiles to runtime JavaScript in `src/gen`.

1. Install dependencies:
	- `npm install`
2. Build TypeScript output:
	- `npm run build`
3. Optional watch mode while developing:
	- `npm run watch`

The extension manifest and HTML entry points load files from `src/gen`, so run a build before loading or reloading the unpacked extension.

## 1) Configure Google and Firebase

### A. Create Firebase project
1. In Firebase Console, create a project.
2. Enable Authentication -> Sign-in method -> Google.
3. Create Firestore database.
4. Copy Web API key and Project ID.

### B. Configure extension OAuth client
1. Create OAuth Client ID in Google Cloud (type: Chrome App).
2. Use your extension ID for the app if needed after first load.
3. Put OAuth client id in manifest.json oauth2.client_id.

### C. Fill config
Edit `src/config.ts`:
- apiKey = your Firebase Web API key
- projectId = your Firebase project id

## 2) Load extension
1. Open chrome://extensions
2. Enable Developer mode
3. Load unpacked and choose this folder

## 3) Firestore rules (minimal)

Use rules that only allow authenticated user access to their own sessions path.

## Notes
- Pause commits elapsed focus time immediately to totals.
- Reset finalizes the current session with any already-focused time.
- Data is stored locally first, then synced when signed in.
