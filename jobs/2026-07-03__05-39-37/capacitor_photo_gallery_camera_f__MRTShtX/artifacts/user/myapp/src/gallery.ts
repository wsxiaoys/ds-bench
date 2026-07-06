import { Camera } from "@capacitor/camera";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";

const PHOTO_INDEX_KEY = "photo_index";

/**
 * Read the JSON-encoded array of stored photo paths from Preferences.
 * Returns an empty array when the key has never been written.
 */
async function readIndex(): Promise<string[]> {
  const { value } = await Preferences.get({ key: PHOTO_INDEX_KEY });
  if (value === null || value === undefined) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === "string");
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Overwrite the stored photo index with the given array of paths.
 */
async function writeIndex(paths: string[]): Promise<void> {
  await Preferences.set({
    key: PHOTO_INDEX_KEY,
    value: JSON.stringify(paths),
  });
}

/**
 * Capture (or, on Web, pick) a photo, persist its JPEG bytes into the
 * device's `Directory.Data` folder at `photos/<isoTimestamp>.jpeg`, append
 * the new path to the Preferences index, and resolve with that path.
 */
export async function capturePhoto(): Promise<string> {
  const result = await Camera.takePhoto({
    saveToGallery: false,
    includeMetadata: true,
  });

  const imageBytes = result.thumbnail;
  if (!imageBytes) {
    throw new Error("Camera.takePhoto did not return image bytes in `thumbnail`");
  }

  const isoTimestamp = new Date().toISOString();
  const path = `photos/${isoTimestamp}.jpeg`;

  await Filesystem.writeFile({
    path,
    data: imageBytes,
    directory: Directory.Data,
    recursive: true,
  });

  const index = await readIndex();
  index.push(path);
  await writeIndex(index);

  return path;
}

/**
 * Return the current array of stored photo paths from Preferences.
 * Resolves with an empty array when the key has never been written.
 */
export async function listPhotos(): Promise<string[]> {
  return readIndex();
}

/**
 * Remove the file at `path` from `Directory.Data` and update the Preferences
 * index so the deleted path is no longer present. If the file does not exist
 * the index is still updated.
 */
export async function deletePhoto(path: string): Promise<void> {
  try {
    await Filesystem.deleteFile({
      path,
      directory: Directory.Data,
    });
  } catch {
    // The file may not exist (e.g. already deleted). The index must still be
    // updated regardless, so we intentionally swallow this error.
  }

  const index = await readIndex();
  const next = index.filter((entry) => entry !== path);
  await writeIndex(next);
}

export type { };