# Recursive Directory Export with Capacitor Filesystem

## Background
You are building a browser-runnable utility on top of Capacitor's `@capacitor/filesystem` plugin (web implementation, which is backed by IndexedDB). The utility recursively walks a directory tree stored in the app's **Data** directory (`Directory.Data`), mirrors that tree into another directory, and produces a JSON manifest describing every file it found. The tree can contain arbitrarily nested subdirectories as well as empty folders, and both must be handled correctly.

The project is a Vite + TypeScript web app. It is served as a normal web page (no native build, no device, no emulator) and is exercised through a headless browser.

## Requirements
- Use `@capacitor/core` and `@capacitor/filesystem` (v8, web implementation) in a Vite + TypeScript project.
- Implement an async export utility that, given a source directory, a destination directory, and a manifest path (all relative paths inside `Directory.Data`):
  - Recursively traverses the source tree, descending into every nested subdirectory.
  - Copies every file into the destination directory, preserving the exact relative directory structure and file contents.
  - Recreates every subdirectory in the destination, including **empty** folders.
  - Builds a manifest object listing every file with its relative path and byte size, plus the list of every subdirectory, and writes it as JSON to the manifest path.
- The page must load without a native runtime (it runs purely on the web/IndexedDB implementation).

## Implementation Hints
- The Filesystem `readdir` API is **not** recursive; you must implement the recursion yourself and distinguish files from directories using the entry `type` field.
- Use the `mkdir` / `writeFile` `recursive` option to materialize nested destination paths, and remember that empty source directories still need to exist in the destination.
- Record each file's size using the value returned by the Filesystem `stat` API (the `size` field), not by measuring strings yourself.
- Relative paths in the manifest must be POSIX-style (forward slashes), relative to the source directory root, with no leading `./` or `/`.

### Hard requirements (must hold exactly)
- Project path: `/home/user/project`
- The app is built with `npm run build` and served with `npm run preview` on **port 4173** (route `/`).
- When the page at `/` has loaded, it must expose the following on `window`:
  - `window.CapacitorFilesystem` — an object `{ Filesystem, Directory, Encoding }` re-exporting those exact members from `@capacitor/filesystem` (used to drive and inspect the utility from the browser).
  - `window.runDirectoryExport(options)` — an async function that performs the export. `options` is an object with keys `sourceDir` (string), `destDir` (string), and `manifestPath` (string), each a relative path inside `Directory.Data`.
- `window.runDirectoryExport` must return a Promise that resolves to the manifest object, and must also write that same object as JSON (UTF-8) to `manifestPath` inside `Directory.Data`.
- The manifest object must have exactly these keys:
  - `files`: array of objects `{ "path": string, "size": number }`, one per file found anywhere in the tree, sorted ascending by `path`.
  - `directories`: array of strings, the relative POSIX path of every subdirectory under the source root (including empty ones), excluding the source root itself, sorted ascending.
  - `totalFiles`: number, equal to `files.length`.
  - `totalBytes`: number, equal to the sum of all file `size` values.
- The destination directory must, after the call, contain a byte-for-byte copy of every source file at the same relative path, and must contain every source subdirectory (empty folders included).

