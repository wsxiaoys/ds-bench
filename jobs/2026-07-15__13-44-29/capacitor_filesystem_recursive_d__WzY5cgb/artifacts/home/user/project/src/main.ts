import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export interface RunDirectoryExportOptions {
  sourceDir: string;
  destDir: string;
  manifestPath: string;
}

export interface FileManifestEntry {
  path: string;
  size: number;
}

export interface ExportManifest {
  files: FileManifestEntry[];
  directories: string[];
  totalFiles: number;
  totalBytes: number;
}

// Helper to join path segments with forward slashes, removing leading/trailing slashes
function joinPaths(...parts: string[]): string {
  return parts
    .map(part => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

/**
 * Recursively exports a directory tree inside Directory.Data.
 */
export async function runDirectoryExport(options: RunDirectoryExportOptions): Promise<ExportManifest> {
  const { sourceDir, destDir, manifestPath } = options;

  const filesList: FileManifestEntry[] = [];
  const dirsList: string[] = [];

  // Recursive traversal function
  async function traverse(currentPath: string, relativePathParts: string[]) {
    const readdirResult = await Filesystem.readdir({
      path: currentPath,
      directory: Directory.Data,
    });

    for (const entry of readdirResult.files) {
      const entrySourcePath = joinPaths(currentPath, entry.name);
      const entryRelPath = joinPaths(...relativePathParts, entry.name);

      if (entry.type === 'directory') {
        dirsList.push(entryRelPath);
        await traverse(entrySourcePath, [...relativePathParts, entry.name]);
      } else if (entry.type === 'file') {
        const statResult = await Filesystem.stat({
          path: entrySourcePath,
          directory: Directory.Data,
        });
        filesList.push({
          path: entryRelPath,
          size: statResult.size,
        });
      }
    }
  }

  // Traverse the source directory recursively
  await traverse(sourceDir, []);

  // Sort files and directories ascending by their relative path
  filesList.sort((a, b) => a.path.localeCompare(b.path));
  dirsList.sort((a, b) => a.localeCompare(b));

  // Recreate the destination root directory
  try {
    await Filesystem.mkdir({
      path: destDir,
      directory: Directory.Data,
      recursive: true,
    });
  } catch (e: any) {
    // Ignore if directory already exists
  }

  // Recreate all subdirectories in the destination
  for (const dirRelPath of dirsList) {
    const destSubdirPath = joinPaths(destDir, dirRelPath);
    try {
      await Filesystem.mkdir({
        path: destSubdirPath,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (e: any) {
      // Ignore if directory already exists
    }
  }

  // Copy every file to the destination
  for (const fileObj of filesList) {
    const fileRelPath = fileObj.path;
    const srcFilePath = joinPaths(sourceDir, fileRelPath);
    const destFilePath = joinPaths(destDir, fileRelPath);

    await Filesystem.copy({
      from: srcFilePath,
      to: destFilePath,
      directory: Directory.Data,
      toDirectory: Directory.Data,
    });
  }

  // Build the final manifest object
  const manifest: ExportManifest = {
    files: filesList,
    directories: dirsList,
    totalFiles: filesList.length,
    totalBytes: filesList.reduce((sum, f) => sum + f.size, 0),
  };

  // Write the manifest as JSON (UTF-8) to manifestPath inside Directory.Data
  await Filesystem.writeFile({
    path: manifestPath,
    directory: Directory.Data,
    data: JSON.stringify(manifest),
    encoding: Encoding.UTF8,
    recursive: true,
  });

  return manifest;
}

// Expose members on window
(window as any).CapacitorFilesystem = { Filesystem, Directory, Encoding };
(window as any).runDirectoryExport = runDirectoryExport;
