import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

const PHOTO_INDEX_KEY = 'photo_index';
const PHOTOS_DIR = 'photos';

/**
 * Read the current JSON index of stored photo paths from Preferences.
 * Returns an empty array if the key has never been written.
 */
async function readIndex(): Promise<string[]> {
  const { value } = await Preferences.get({ key: PHOTO_INDEX_KEY });
  if (value === null || value === undefined || value === '') {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persist the photo path index to Preferences, JSON-serialising the array.
 */
async function writeIndex(photos: string[]): Promise<void> {
  await Preferences.set({
    key: PHOTO_INDEX_KEY,
    value: JSON.stringify(photos),
  });
}

/**
 * Capture a photo through the Capacitor Camera plugin, persist its
 * bytes through the Capacitor Filesystem plugin, append the freshly
 * written path to the Preferences index, and resolve with that path.
 */
export async function capturePhoto(): Promise<string> {
  const result = await Camera.takePhoto({
    saveToGallery: false,
    includeMetadata: true,
    resultType: CameraResultType.Base64,
    source: CameraSource.Prompt,
    quality: 100,
  });

  // On Web, for MediaType.Photo, the full image is returned in
  // `result.thumbnail` as a base64-encoded data URL. Strip any
  // optional `data:image/jpeg;base64,` prefix so we hand raw
  // base64 bytes to the Filesystem plugin.
  let base64Data: string = result.thumbnail ?? '';
  const commaIdx = base64Data.indexOf(',');
  if (commaIdx !== -1) {
    base64Data = base64Data.substring(commaIdx + 1);
  }

  const timestamp = new Date().toISOString();
  const path = `${PHOTOS_DIR}/${timestamp}.jpeg`;

  await Filesystem.writeFile({
    path,
    data: base64Data,
    directory: Directory.Data,
    recursive: true,
  });

  const current = await readIndex();
  current.push(path);
  await writeIndex(current);

  return path;
}

/**
 * Return the current array of stored photo paths.
 * Resolves with an empty array if the index has never been written.
 */
export async function listPhotos(): Promise<string[]> {
  return readIndex();
}

/**
 * Remove a photo from the Filesystem and from the Preferences index.
 * If the file does not exist on disk the index is still updated.
 */
export async function deletePhoto(path: string): Promise<void> {
  try {
    await Filesystem.deleteFile({
      path,
      directory: Directory.Data,
    });
  } catch {
    // Swallow filesystem errors: even if the file is missing, the
    // index must still be scrubbed of the stale entry.
  }

  const current = await readIndex();
  const next = current.filter((p) => p !== path);
  if (next.length !== current.length) {
    await writeIndex(next);
  }
}

// Expose the gallery on `window.gallery` so REDACTEDmated tests can
// drive the application programmatically. The block is idempotent
// and safe to re-evaluate (e.g. on HMR reloads).
declare global {
  interface Window {
    gallery?: {
      capturePhoto: typeof capturePhoto;
      listPhotos: typeof listPhotos;
      deletePhoto: typeof deletePhoto;
    };
  }
}

if (typeof window !== 'undefined') {
  window.gallery = {
    capturePhoto,
    listPhotos,
    deletePhoto,
  };
}
