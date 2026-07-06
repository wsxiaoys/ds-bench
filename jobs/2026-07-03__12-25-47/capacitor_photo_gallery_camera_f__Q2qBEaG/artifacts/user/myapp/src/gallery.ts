import { Camera, MediaType } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

const INDEX_KEY = 'photo_index';

async function readIndex(): Promise<string[]> {
  const { value } = await Preferences.get({ key: INDEX_KEY });
  if (value === null || value === undefined) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((v) => typeof v === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

async function writeIndex(paths: string[]): Promise<void> {
  await Preferences.set({
    key: INDEX_KEY,
    value: JSON.stringify(paths),
  });
}

export async function capturePhoto(): Promise<string> {
  const result: any = await Camera.takePhoto({
    saveToGallery: false,
    includeMetadata: true,
  });

  // On Web, for MediaType.Photo, the full image base64 is in `thumbnail`.
  const data: string | undefined =
    result?.thumbnail ?? result?.base64String ?? result?.dataUrl;
  if (!data) {
    throw new Error('No image data returned from camera');
  }

  const isoTimestamp = new Date().toISOString();
  const fileName = `photos/${isoTimestamp}.jpeg`;

  await Filesystem.writeFile({
    path: fileName,
    data,
    directory: Directory.Data,
    recursive: true,
  });

  const current = await readIndex();
  current.push(fileName);
  await writeIndex(current);

  return fileName;
}

export async function listPhotos(): Promise<string[]> {
  return readIndex();
}

export async function deletePhoto(path: string): Promise<void> {
  try {
    await Filesystem.deleteFile({
      path,
      directory: Directory.Data,
    });
  } catch {
    // ignore; we still want to update the index
  }

  const current = await readIndex();
  const filtered = current.filter((p) => p !== path);
  if (filtered.length !== current.length) {
    await writeIndex(filtered);
  }
}
