import { Filesystem, Directory } from '@capacitor/filesystem';

async function run() {
  try {
    // 1. Load the bundled binary image served at "/sample.png"
    const response = await fetch('/sample.png');
    if (!response.ok) {
      throw new Error(`Failed to fetch /sample.png: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const originalBytes = new Uint8Array(arrayBuffer);
    const byteLength = originalBytes.byteLength;

    // Convert to base64
    const originalBase64 = bytesToBase64(originalBytes);

    // Compute original SHA-256 hash
    const originalHash = await computeSHA256(originalBytes);

    // 2. Persist the image with @capacitor/filesystem as binary data into Directory.Data
    const writeResult = await Filesystem.writeFile({
      path: 'images/roundtrip/sample.png',
      data: originalBase64,
      directory: Directory.Data,
      recursive: true,
    });

    // 3. Read the file back as binary
    const readResult = await Filesystem.readFile({
      path: 'images/roundtrip/sample.png',
      directory: Directory.Data,
    });

    let readBase64: string;
    if (typeof readResult.data === 'string') {
      readBase64 = readResult.data;
    } else {
      // In case readResult.data is a Blob or something else
      const blob = readResult.data as Blob;
      readBase64 = await blobToBase64(blob);
    }

    const readBytes = base64ToBytes(readBase64);
    const readbackHash = await computeSHA256(readBytes);

    // 4. List contents of images/roundtrip
    const readdirResult = await Filesystem.readdir({
      path: 'images/roundtrip',
      directory: Directory.Data,
    });

    const entryNames = readdirResult.files.map(file => file.name);

    // 5. Populate DOM elements
    const isMatch = originalHash === readbackHash;

    setDOMText('status', isMatch ? 'OK' : 'FAIL');
    setDOMText('original-hash', originalHash);
    setDOMText('readback-hash', readbackHash);
    setDOMText('match', isMatch ? 'true' : 'false');
    setDOMText('byte-length', byteLength.toString());
    setDOMText('write-uri', writeResult.uri);
    setDOMText('dir-listing', entryNames.join(','));

  } catch (error) {
    console.error('Error during round-trip:', error);
    setDOMText('status', 'FAIL');
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  // Strip any potential header/whitespace
  const cleanedBase64 = base64.trim().replace(/^data:image\/[a-z]+;base64,/, '');
  const binaryString = atob(cleanedBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function computeSHA256(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function setDOMText(id: string, text: string) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  }
}

// Start the round-trip execution
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', run);
} else {
  run();
}
