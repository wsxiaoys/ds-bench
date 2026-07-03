import { Filesystem, Directory } from '@capacitor/filesystem';

const downloadBtn = document.getElementById('download-pdf') as HTMLButtonElement | null;
const statusEl = document.getElementById('download-status') as HTMLElement | null;
const sizeEl = document.getElementById('file-size') as HTMLElement | null;
const sha256El = document.getElementById('file-sha256') as HTMLElement | null;

if (downloadBtn) {
  downloadBtn.addEventListener('click', async () => {
    if (!statusEl) return;
    
    // Set status to downloading
    statusEl.textContent = 'downloading';
    if (sizeEl) sizeEl.textContent = '';
    if (sha256El) sha256El.textContent = '';
    
    try {
      // 1. Download the file served at /sample.pdf relative to the same origin
      const response = await fetch('/sample.pdf');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      
      // 2. Convert ArrayBuffer to base64
      const base64Data = await arrayBufferToBase64(arrayBuffer);
      
      // 3. Save it through Capacitor Filesystem at the path sample.pdf under Directory.Documents
      await Filesystem.writeFile({
        path: 'sample.pdf',
        data: base64Data,
        directory: Directory.Documents
      });
      
      // 4. Read the file back from Capacitor Filesystem to prove it truly persisted
      const readResult = await Filesystem.readFile({
        path: 'sample.pdf',
        directory: Directory.Documents
      });
      
      let persistedBase64 = '';
      if (typeof readResult.data === 'string') {
        persistedBase64 = readResult.data;
      } else if (readResult.data instanceof Blob) {
        persistedBase64 = await blobToBase64(readResult.data);
      } else {
        throw new Error('Unexpected data type returned from Filesystem.readFile');
      }
      
      const persistedBuffer = base64ToArrayBuffer(persistedBase64);
      
      // 5. Get file size and SHA-256 digest
      let fileSize = persistedBuffer.byteLength;
      try {
        const statResult = await Filesystem.stat({
          path: 'sample.pdf',
          directory: Directory.Documents
        });
        if (statResult && typeof statResult.size === 'number') {
          fileSize = statResult.size;
        }
      } catch (statErr) {
        console.warn('Filesystem.stat failed, using buffer length:', statErr);
      }
      
      const fileHash = await computeSHA256(persistedBuffer);
      
      // 6. Update status and values
      statusEl.textContent = 'saved';
      if (sizeEl) {
        sizeEl.textContent = fileSize.toString();
      }
      if (sha256El) {
        sha256El.textContent = fileHash;
      }
      
    } catch (error: any) {
      console.error(error);
      statusEl.textContent = `error: ${error.message || error}`;
    }
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer]);
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function computeSHA256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
