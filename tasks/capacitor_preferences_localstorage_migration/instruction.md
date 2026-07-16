# Migrate legacy localStorage into Capacitor Preferences

## Background
Mobile web views may periodically clear `window.localStorage`, so Capacitor recommends the `@capacitor/preferences` plugin for persistent key/value data. You are given a small Vite web app that still keeps user data in `localStorage`. Implement a **one-time, idempotent migration** that moves the legacy data into `@capacitor/preferences`. On the web the Preferences plugin transparently persists to `localStorage` under its own namespace, so this migration is fully exercisable in a browser.

## Requirements
- Expose an async function `window.migrateStorage()` that migrates legacy `localStorage` entries into Preferences.
- Only migrate `localStorage` keys that start with the `legacy:` prefix. The destination Preferences key is the legacy key with the `legacy:` prefix removed.
- Conflict resolution: never overwrite a Preferences key that already has a value. Such keys are skipped.
- Remove each successfully migrated entry from `localStorage`. Leave skipped (conflicting) entries untouched.
- Make the migration idempotent using a completion flag that is persisted through Preferences, so it survives page reloads.

## Implementation Hints
- Project path: /home/user/storage-migration
- Use `@capacitor/preferences` for every read/write of Preferences data (including the completion flag). Read the legacy values directly from `window.localStorage`.
- The migration must run **only** when `window.migrateStorage()` is invoked — never automatically on page load (the verifier seeds data after the page loads, then calls it).
- Destination key = the legacy key without its leading `legacy:` prefix (e.g. `legacy:theme` -> `theme`). Keys without the `legacy:` prefix must be ignored entirely.
- Conflict rule: if the destination key already has a value in Preferences, skip it — do not overwrite it and do not remove its `legacy:` `localStorage` entry.
- After a key is migrated, delete its original `legacy:`-prefixed entry from `localStorage`.
- Enforce idempotency with a completion flag persisted through Preferences; once it is set, every further call performs no migration.
- `window.migrateStorage()` must resolve to a report object with exactly these keys: `alreadyCompleted` (boolean), `migrated` (array of destination keys migrated during this call), and `skipped` (array of destination keys skipped because a Preferences value already existed). When the completion flag was already set before the call, `alreadyCompleted` is `true` and both `migrated` and `skipped` are empty arrays.
- Start command: `npm run build && npm run preview -- --port 4173 --host 127.0.0.1`
- Port: 4173 (the page is served at http://127.0.0.1:4173/)

