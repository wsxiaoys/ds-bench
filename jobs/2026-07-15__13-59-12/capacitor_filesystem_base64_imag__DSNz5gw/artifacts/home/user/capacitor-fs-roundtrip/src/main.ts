import { Filesystem, Directory } from "@capacitor/filesystem";

/**
 * Convert an ArrayBuffer of raw bytes to a base64 string without corrupting
 * binary data (avoids String.fromCharCode on the whole buffer at once, which
 * can break on large buffers and produce incorrect output for bytes > 0x7F
 * when interpreted as UTF-8).
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000; // 32k chunks — safe limit for apply()
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return btoa(binary);
}

/** Decode a base64 string into a Uint8Array of raw bytes. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Compute the SHA-256 digest of raw bytes, returned as lowercase hex. */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as unknown as BufferSource,
  );
  const view = new Uint8Array(digest);
  return Array.from(view)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

async function run(): Promise<void> {
  try {
    // 1. Load the bundled binary image and base64-encode its raw bytes.
    const response = await fetch("/sample.png");
    if (!response.ok) {
      throw new Error(`Failed to fetch /sample.png: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const originalBytes = new Uint8Array(arrayBuffer);
    const base64Data = bytesToBase64(originalBytes);

    // 2. Persist the image as binary into Directory.Data at
    //    images/roundtrip/sample.png, creating missing parent directories.
    const writeResult = await Filesystem.writeFile({
      path: "images/roundtrip/sample.png",
      data: base64Data,
      directory: Directory.Data,
      recursive: true,
      // No `encoding` option => binary write (base64 is decoded to bytes).
    });

    // 3. Read the file back as binary (no encoding => returns base64).
    const readResult = await Filesystem.readFile({
      path: "images/roundtrip/sample.png",
      directory: Directory.Data,
      // No `encoding` option => binary read (data returned as base64 string).
    });
    const readBackBase64 =
      typeof readResult.data === "string" ? readResult.data : "";
    const readBackBytes = base64ToBytes(readBackBase64);

    // 4. Compute SHA-256 hashes of original and read-back bytes.
    const originalHash = await sha256Hex(originalBytes);
    const readBackHash = await sha256Hex(readBackBytes);
    const match = originalHash === readBackHash;

    // 5. List the contents of the images/roundtrip directory.
    const dirResult = await Filesystem.readdir({
      path: "images/roundtrip",
      directory: Directory.Data,
    });
    const dirListing = dirResult.files.map((f) => f.name).join(",");

    // 6. Render all results into the DOM.
    setText("status", match ? "OK" : "FAIL");
    setText("original-hash", originalHash);
    setText("readback-hash", readBackHash);
    setText("match", match ? "true" : "false");
    setText("byte-length", String(originalBytes.length));
    setText("write-uri", writeResult.uri);
    setText("dir-listing", dirListing);
  } catch (err) {
    // On any failure, mark status as FAIL and surface the error details.
    console.error("Round-trip failed:", err);
    setText("status", "FAIL");
    const message = err instanceof Error ? err.message : String(err);
    setText("original-hash", `ERROR: ${message}`);
  }
}

void run();