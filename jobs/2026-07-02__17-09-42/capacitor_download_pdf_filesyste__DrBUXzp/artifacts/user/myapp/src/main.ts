import { Directory, Filesystem } from "@capacitor/filesystem";

const FILE_PATH = "sample.pdf";

const statusEl = document.getElementById("download-status") as HTMLElement;
const sizeEl = document.getElementById("file-size") as HTMLElement;
const shaEl = document.getElementById("file-sha256") as HTMLElement;
const buttonEl = document.getElementById("download-pdf") as HTMLButtonElement;

function setStatus(text: string): void {
  statusEl.textContent = text;
}

/** Convert an ArrayBuffer to a base64 string. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Chunked conversion so large files don't blow the call stack.
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

/** Decode a base64 string (the default Filesystem.readFile output) to an ArrayBuffer. */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Compute the lowercase hex SHA-256 digest of an ArrayBuffer using the Web Crypto API. */
async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hashBytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < hashBytes.length; i++) {
    hex += hashBytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

async function downloadAndPersistPdf(): Promise<void> {
  setStatus("downloading");
  buttonEl.disabled = true;

  try {
    // 1. Download /sample.pdf from the same origin.
    const response = await fetch("/sample.pdf");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching /sample.pdf`);
    }
    const downloadedBuffer = await response.arrayBuffer();

    // 2. Persist the bytes via @capacitor/filesystem into Documents.
    // The web implementation writes into IndexedDB; native writes to disk.
    const base64 = arrayBufferToBase64(downloadedBuffer);
    await Filesystem.writeFile({
      path: FILE_PATH,
      directory: Directory.Documents,
      data: base64,
      recursive: true,
    });

    // 3. Read it BACK from the Filesystem to prove it persisted.
    const readResult = await Filesystem.readFile({
      path: FILE_PATH,
      directory: Directory.Documents,
    });
    const persistedBuffer = base64ToArrayBuffer(readResult.data as string);

    // 4. Get the on-disk size from Filesystem.stat (not from memory).
    const stat = await Filesystem.stat({
      path: FILE_PATH,
      directory: Directory.Documents,
    });

    // 5. Surface size + SHA-256 of the persisted copy.
    sizeEl.textContent = String(stat.size);
    shaEl.textContent = await sha256Hex(persistedBuffer);

    setStatus("saved");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus(`error: ${message}`);
    console.error("Failed to persist PDF:", err);
  } finally {
    buttonEl.disabled = false;
  }
}

buttonEl.addEventListener("click", () => {
  void downloadAndPersistPdf();
});
