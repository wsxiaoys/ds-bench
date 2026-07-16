// Capacitor Filesystem base64 image round-trip.
//
// On page load we:
//   1. Load the binary image served at "/sample.png" and convert its raw
//      bytes into a base64 string.
//   2. Write that base64 data as BINARY into Directory.Data at
//      "images/roundtrip/sample.png", creating the missing parent directories.
//   3. Read the file back as BINARY (which yields base64) and decode it.
//   4. Hash both the original and the read-back bytes with SHA-256 and
//      compare to prove byte-for-byte integrity.
//   5. List the contents of the "images/roundtrip" directory.
//   6. Render every result into the existing DOM elements.
//
// On the web, @capacitor/filesystem transparently uses its IndexedDB-backed
// web implementation; no native runtime is required.

import { Directory, Filesystem } from "@capacitor/filesystem";

// ---------------------------------------------------------------------------
// Small DOM helpers
// ---------------------------------------------------------------------------

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function setStatus(value: "OK" | "FAIL"): void {
  setText("status", value);
}

// ---------------------------------------------------------------------------
// Base64 <-> Uint8Array helpers (no data-URL prefix).
// ---------------------------------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  // Build a binary string in chunks so we stay well under the JS engine's
  // argument-count limit when calling String.fromCharCode via apply().
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)),
    );
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  // `new Uint8Array(length)` allocates a fresh ArrayBuffer (never shared),
  // which keeps the buffer type narrow for crypto.subtle.digest.
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

// ---------------------------------------------------------------------------
// SHA-256 hashing -> lowercase hex digest.
// ---------------------------------------------------------------------------

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  // crypto.subtle.digest is available on localhost and 127.0.0.1 in modern
  // browsers, so this works inside the Vite dev server as well.
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const view = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// ---------------------------------------------------------------------------
// The round-trip itself.
// ---------------------------------------------------------------------------

async function runRoundTrip(): Promise<void> {
  // 1. Load the binary PNG from the dev server's /public folder.
  const response = await fetch("/sample.png");
  if (!response.ok) {
    throw new Error(
      `Failed to fetch /sample.png: HTTP ${response.status} ${response.statusText}`,
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  // `new Uint8Array(ArrayBuffer)` is typed as Uint8Array<ArrayBuffer>,
  // so its `buffer` is a regular ArrayBuffer (not SharedArrayBuffer).
  const originalBytes = new Uint8Array(arrayBuffer);

  // 2. Convert the raw bytes to a base64 string.
  const originalBase64 = bytesToBase64(originalBytes);

  // 3. Hash the original bytes.
  const originalHash = await sha256Hex(originalBytes);

  // 4. Write the base64 data as BINARY into Directory.Data at the target
  //    path. With no `encoding` option, the web Filesystem impl expects the
  //    payload to already be base64 and stores it as binary on disk.
  const writeResult = await Filesystem.writeFile({
    path: "images/roundtrip/sample.png",
    data: originalBase64,
    directory: Directory.Data,
    recursive: true,
  });

  // 5. Read the file back as BINARY (no `encoding` => base64 returned).
  const readResult = await Filesystem.readFile({
    path: "images/roundtrip/sample.png",
    directory: Directory.Data,
  });

  if (typeof readResult.data !== "string") {
    throw new Error(
      "Filesystem.readFile did not return a base64 string for binary data",
    );
  }

  // 6. Recover bytes from the base64 payload and hash them.
  const readBackBytes = base64ToBytes(readResult.data);
  const readBackHash = await sha256Hex(readBackBytes);

  // 7. Compare. Length equality is implied by identical SHA-256 digests, but
  //    we also expose the original byte length for visibility.
  const match = originalHash === readBackHash;

  // 8. Confirm the file is present in the target directory.
  const dirResult = await Filesystem.readdir({
    path: "images/roundtrip",
    directory: Directory.Data,
  });
  const dirNames = dirResult.files.map((f) => f.name);

  // 9. Render everything into the DOM so the headless browser can inspect it.
  setText("original-hash", originalHash);
  setText("readback-hash", readBackHash);
  setText("match", String(match));
  setText("byte-length", String(originalBytes.length));
  setText("write-uri", writeResult.uri);
  setText("dir-listing", dirNames.join(","));
  setStatus(match ? "OK" : "FAIL");
}

// ---------------------------------------------------------------------------
// Kick off on module load. Any error fails the verification.
// ---------------------------------------------------------------------------

runRoundTrip().catch((err) => {
  // Surface the error in the dev console for debugging, but still report
  // FAIL so the verification harness sees a conclusive result.
  // eslint-disable-next-line no-console
  console.error("Capacitor filesystem round-trip failed:", err);
  setStatus("FAIL");
});
