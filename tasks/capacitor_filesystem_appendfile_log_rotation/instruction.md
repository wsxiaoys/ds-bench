# Rolling File Logger with Capacitor Filesystem (Web)

## Background
Build a browser-based rolling file logger for a **Capacitor v8** web app using the `@capacitor/filesystem` plugin. In the browser the plugin uses its web implementation, which is backed by IndexedDB. The logger appends log lines to an active file and, once that file grows past a configurable byte threshold, rotates it (`app.log` -> `app.1.log` -> `app.2.log` -> ...), keeping only a bounded number of archive files and discarding the oldest data. It also exposes a reader that reconstructs the full retained log in chronological order.

## Requirements
- Append individual log records to an active log file using the Filesystem plugin's append capability.
- When the active file would exceed a configurable byte threshold, rotate the files, keeping at most `N` archives and deleting the oldest data beyond that limit.
- A single record must never be split across two files.
- Provide a reader that returns every retained line in chronological order (oldest first) across all files.
- All data must persist across page reloads via the Filesystem web storage.

## Implementation Hints
- Use `@capacitor/filesystem` (`appendFile`, `stat`, `rename`, `deleteFile`, `readFile`, `readdir`) with `Directory.Data`. Determine file sizes from the filesystem (e.g. `stat`) rather than tracking them only in memory.
- Store logs under `Directory.Data` in a folder named `logs`. The active file is `app.log`; rotated archives are `app.1.log`, `app.2.log`, ..., where `app.1.log` is the most recently rotated file and larger indices are older.
- Rotation must run **before** writing a record: if the active file already exists and its current size plus the UTF-8 byte length of the new record (the line text followed by a single `\n`) exceeds the configured threshold, rotate first and then append the record to a fresh active file. The first ever record (no active file yet) is written without rotating, even if it alone exceeds the threshold.
- On rotation, retain at most `N` archive files: delete the archive that would exceed the limit (the oldest) before shifting the remaining archives up by one and moving `app.log` to `app.1.log`.
- Records are written as the provided line text followed by exactly one `\n`.
- Expose a global object `window.rollingLog` (available after the page loads) with these async methods:
  - `configure({ maxBytes, maxArchives })`: set the byte threshold and the number of archive files to retain, and clear any existing log files for a fresh start.
  - `append(line)`: append one record, rotating first if needed.
  - `readAll()`: resolve to an array of every retained line in chronological order (oldest first) across all archives and the active file, with trailing newlines stripped and no empty entries.
  - `archives()`: resolve to an array of `{ name, size }` objects for the archive files that currently exist (excluding the active `app.log`), where `size` is the file size in bytes. The array may be in any order.
- Loading the page must not delete existing logs; only `configure()` clears them.
- Project path: /home/user/myproject
- The app is a static web build. Start command: `npm run build && npm run preview -- --port 4173 --host 127.0.0.1`
- The app is served at http://127.0.0.1:4173/ and `window.rollingLog` must be reachable from the page's JavaScript context.

