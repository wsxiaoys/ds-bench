# Capacitor Filesystem Base64 Image Round-Trip with Integrity Check

## Background
You are building a browser-first Capacitor v8 application (running under the Filesystem plugin's **web** implementation, which is backed by IndexedDB). A small binary image asset ships with the app, and you must prove that it can be persisted to and recovered from device storage **without any corruption**. On the web, `@capacitor/filesystem` stores files inside IndexedDB, so the whole flow must run entirely inside the browser — no native device, emulator, or network access is available.

A Vite + TypeScript project has already been scaffolded for you with `@capacitor/core` and `@capacitor/filesystem` installed. A binary PNG asset is served by the dev server at the URL path `/sample.png`. Your job is to implement the round-trip logic in `src/main.ts` and render the results into the page.

## Requirements
- On page load, load the bundled binary image that is served at `/sample.png` and convert its raw bytes to a base64 string.
- Persist the image with `@capacitor/filesystem` as **binary** data into `Directory.Data` at the relative path `images/roundtrip/sample.png`, creating the missing parent directories (`images/roundtrip`) automatically.
- Read the file back from the same location as **binary** data and recover its bytes.
- Compute the SHA-256 hash of the original bytes and of the read-back bytes and compare them to confirm byte-for-byte integrity.
- List the contents of the `images/roundtrip` directory to confirm the file is present.
- Render all results into the DOM so they can be inspected by an automated headless browser.

## Implementation Hints
- Because this runs on the web, importing and calling `@capacitor/filesystem` automatically uses its web (IndexedDB) implementation — no native runtime is needed.
- Writing binary data means passing base64 data to `writeFile` **without** an `Encoding` (passing an `Encoding` writes text, not binary). Reading binary data means calling `readFile` **without** an `Encoding`, which returns base64.
- Use `Directory.Data` and enable recursive parent-directory creation. `Filesystem.readdir` returns the directory entries.
- Compute SHA-256 with the browser's `crypto.subtle` (available on `localhost`) and format the digest as lowercase hexadecimal.
- Project path: /home/user/capacitor-fs-roundtrip
- Start command: `npm run dev` (the project is preconfigured to serve on host `0.0.0.0`, port `4173`).
- Port: 4173
- The written file MUST live in `Directory.Data` at path `images/roundtrip/sample.png`.
- After the round-trip completes, populate exactly these DOM elements (they already exist in `index.html`) with these exact text contents:
  - `#status`: the string `OK` when the read-back hash equals the original hash, otherwise `FAIL`.
  - `#original-hash`: lowercase hex SHA-256 digest of the original image bytes.
  - `#readback-hash`: lowercase hex SHA-256 digest of the bytes read back from the Filesystem.
  - `#match`: the string `true` if the two hashes are equal, otherwise `false`.
  - `#byte-length`: the decimal integer byte length of the original image.
  - `#write-uri`: the exact `uri` string returned by `Filesystem.writeFile`.
  - `#dir-listing`: a comma-separated list of the entry names returned by `Filesystem.readdir` for `images/roundtrip`; it MUST include `sample.png`.
- If any step throws, set `#status` to `FAIL` (do not leave it blank).

