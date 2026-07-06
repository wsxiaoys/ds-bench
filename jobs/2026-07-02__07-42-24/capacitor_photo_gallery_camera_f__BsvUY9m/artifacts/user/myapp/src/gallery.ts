import { Camera } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

export async function capturePhoto(): Promise<string> {
  const result = await Camera.takePhoto({
    saveToGallery: false,
    includeMetadata: true,
  });

  if (!result.thumbnail) {
    throw new Error('No photo data found in thumbnail');
  }

  const isoTimestamp = new Date().toISOString();
  const path = `photos/${isoTimestamp}.jpeg`;

  await Filesystem.writeFile({
    path: path,
    data: result.thumbnail,
    directory: Directory.Data,
    recursive: true,
  });

  const photos = await listPhotos();
  photos.push(path);

  await Preferences.set({
    key: 'photo_index',
    value: JSON.stringify(photos),
  });

  return path;
}

export async function listPhotos(): Promise<string[]> {
  const { value } = await Preferences.get({ key: 'photo_index' });
  if (value === null) {
    return [];
  }
  try {
    return JSON.parse(value);
  } catch (e) {
    return [];
  }
}

export async function deletePhoto(path: string): Promise<void> {
  try {
    await Filesystem.deleteFile({
      path: path,
      directory: Directory.Data,
    });
  } catch (error) {
    console.warn(`Filesystem.deleteFile failed for path: ${path}`, error);
  }

  const photos = await listPhotos();
  const updatedPhotos = photos.filter((p) => p !== path);

  await Preferences.set({
    key: 'photo_index',
    value: JSON.stringify(updatedPhotos),
  });
}
