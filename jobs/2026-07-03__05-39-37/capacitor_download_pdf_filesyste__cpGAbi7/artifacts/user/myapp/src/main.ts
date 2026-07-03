import { Filesystem, Directory } from "@capacitor/filesystem";

const SAMPLE_URL = "/sample.pdf";
const SAVE_PATH = "sample.pdf";

const statusEl = document.getElementById("download-status") as HTMLElement;
const sizeEl = document.getElementById("file-size") as HTMLElement;
const shaEl = document.getElementById("file-sha256") as HTMLElement;
const button = document.getElementById("download-pdf") as HTMLButtonElement;

function setStatus(state: "idle" | "downloading" | "saved" | "error", text: string) {
  statusEl.textContent = text;
  statusEl.className = state;
}

/** Convert an ArrayBuffer to a base64 string without overflowing the call stack. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32k chunks keep String.fromCharCode stacks small
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

/** Decode a base64 string (with optional data-URL prefix) into a Uint8Array. */
function base64ToUint8Array(b64: string): Uint8Array {
  const cleaned = b64.includes(",") ? b64.split(",")[1] : b64;
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Compute the lowercase hex SHA-256 digest of a byte array. */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function downloadAndSave() {
  button.disabled = true;
  setStatus("downloading", "downloading");
  sizeEl.textContent = "—";
  shaEl.textContent = "—";
  try {
    // 1. Fetch the PDF over HTTP from the same origin.
    const response = await fetch(SAMPLE_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${SAMPLE_URL}`);
    }
    const buffer = await response.arrayBuffer();

    // 2. Persist the bytes through Capacitor Filesystem (NOT localStorage/IndexedDB directly).
    //    Binary data must be base64-encoded when no encoding is provided.
    const base64 = arrayBufferToBase64(buffer);
    await Filesystem.writeFile({
      path: SAVE_PATH,
      directory: Directory.Documents,
      data: base64,
      recursive: false,
    });

    // 3. Read the file BACK from Filesystem to prove it persisted.
    const readResult = await Filesystem.readFile({
      path: SAVE_PATH,
      directory: Directory.Documents,
    });
    const savedBytes = base64ToUint8Array(readResult.data);

    // 4. Compute size + SHA-256 from the read-back bytes.
    const size = savedBytes.length;
    const digest = await sha256Hex(savedBytes);

    sizeEl.textContent = String(size);
    shaEl.textContent = digest;
    setStatus("saved", "saved");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "unknown error";
    setStatus("error", `error: ${message}`);
  } finally {
    button.disabled = false;
  }
}

button.addEventListener("click", () => {
  void downloadAndSave();
});

// Ensure the idle state is present on initial load.
setStatus("idle", "idle");