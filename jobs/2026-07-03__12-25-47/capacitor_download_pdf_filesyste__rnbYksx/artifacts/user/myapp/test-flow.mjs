import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { webcrypto } = require('crypto');

// Set up globals for the Capacitor plugin
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/REDACTED';

const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
<main id="app">
  <h1>Filesystem Demo</h1>
  <button id="download-pdf" type="button">Download PDF</button>
  <p id="download-status">idle</p>
  <p>File size: <span id="file-size"></span> bytes</p>
  <p>SHA-256: <span id="file-sha256"></span></p>
</main>
</body>
</html>
`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost:4173/' });

const { window } = dom;
global.window = window;
global.document = window.document;
global.indexedDB = window.indexedDB;
if (!window.crypto) window.crypto = webcrypto;

// Use the CJS version of the Filesystem plugin
const fsModule = require('/home/user/myapp/node_modules/@capacitor/filesystem/dist/plugin.cjs.js');
const { Filesystem, Directory } = fsModule;

// Test the flow
async function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// Read the actual PDF
const pdfBuffer = require('fs').readFileSync('/home/user/myapp/public/sample.pdf');
const pdfArrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength);
const base64 = arrayBufferToBase64(pdfArrayBuffer);

console.log('Original PDF size:', pdfArrayBuffer.byteLength);
console.log('Base64 length:', base64.length);

// Write to filesystem
await Filesystem.writeFile({
  path: 'sample.pdf',
  data: base64,
  directory: Directory.Documents,
  recursive: true,
});
console.log('Wrote file');

// Read back
const readResult = await Filesystem.readFile({
  path: 'sample.pdf',
  directory: Directory.Documents,
});
console.log('Read result type:', typeof readResult.data);
console.log('Read data length:', readResult.data.length);

const base64FromDisk = readResult.data;
const persistedBuffer = base64ToArrayBuffer(base64FromDisk);
const persistedSize = persistedBuffer.byteLength;
const digest = await crypto.subtle.digest('SHA-256', persistedBuffer);
const sha256 = bufferToHex(digest);

console.log('Persisted Size:', persistedSize);
console.log('SHA-256:', sha256);
console.log('Expected SHA-256: 112a26a6a4e25cd8fba7779c0a29548932e5ea7e263f0b2ff769f55b01901940');
console.log('Match:', sha256 === '112a26a6a4e25cd8fba7779c0a29548932e5ea7e263f0b2ff769f55b01901940');
