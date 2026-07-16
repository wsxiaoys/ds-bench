import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportFileEntry {
  path: string;
  size: number;
}

export interface ExportManifest {
  files: ExportFileEntry[];
  directories: string[];
  totalFiles: number;
  totalBytes: number;
}

export interface ExportOptions {
  sourceDir: string;
  destDir: string;
  manifestPath: string;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Join path segments using POSIX-style forward slashes.
 * Empty / "." segments are skipped so we never produce a leading "./" or "/".
 */
function posixJoin(...segments: string[]): string {
  return segments
    .map((s) => s.replace(/\\/g, '/'))
    .flatMap((s) => s.split('/'))
    .filter((seg) => seg !== '' && seg !== '.')
    .join('/');
}

/** Normalise a user-supplied relative path to POSIX style with no leading ./ or /. */
function normalisePath(p: string): string {
  return posixJoin(p);
}

/** Normalised join of a base directory and a relative path. */
function joinPath(base: string, rel: string): string {
  return normalisePath(posixJoin(base, rel));
}

// ---------------------------------------------------------------------------
// Core recursive walk + copy
// ---------------------------------------------------------------------------

interface WalkResult {
  files: ExportFileEntry[];
  directories: string[];
}

/**
 * Recursively walk the source tree rooted at `sourceDir`.
 *
 * `relativePath` is the POSIX-style path relative to the source root (empty
 * string for the root itself).  We collect every file (with its byte size from
 * `stat`) and every subdirectory (relative POSIX path, excluding the source
 * root).  Files are copied straight away so we only hold one file's content in
 * memory at a time.
 */
async function walkAndCopy(
  sourceDir: string,
  destDir: string,
  relativePath: string,
  result: WalkResult,
): Promise<void> {
  const absSource = joinPath(sourceDir, relativePath);

  const { files: entries } = await Filesystem.readdir({
    path: absSource,
    directory: Directory.Data,
  });

  for (const entry of entries) {
    const entryRel = posixJoin(relativePath, entry.name);

    if (entry.type === 'directory') {
      // Record the subdirectory (relative to the source root, POSIX style).
      result.directories.push(entryRel);

      // Materialise the directory in the destination immediately so that empty
      // folders are recreated even when they contain no files at all.
      await Filesystem.mkdir({
        path: joinPath(destDir, entryRel),
        directory: Directory.Data,
        recursive: true,
      });

      // Descend.
      await walkAndCopy(sourceDir, destDir, entryRel, result);
    } else if (entry.type === 'file') {
      // Get the authoritative byte size from `stat`.
      const stat = await Filesystem.stat({
        path: joinPath(sourceDir, entryRel),
        directory: Directory.Data,
      });

      result.files.push({ path: entryRel, size: stat.size });

      // Read the file's stored content verbatim. On the web implementation
      // readFile returns the raw `content` field (the encoding option is
      // ignored), so `data` is exactly what was originally written — whether
      // that was a UTF-8 string or a base64 string.
      const { data } = await Filesystem.readFile({
        path: joinPath(sourceDir, entryRel),
        directory: Directory.Data,
      });

      // Write with Encoding.UTF8 so the data is stored verbatim with no
      // base64 transformation. This guarantees a byte-for-byte copy of the
      // stored content regardless of how the source file was originally
      // written (text or base64).
      await Filesystem.writeFile({
        path: joinPath(destDir, entryRel),
        data,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    }
    // Any other entry types are ignored.
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

async function runDirectoryExport(options: ExportOptions): Promise<ExportManifest> {
  const sourceDir = normalisePath(options.sourceDir);
  const destDir = normalisePath(options.destDir);
  const manifestPath = normalisePath(options.manifestPath);

  // Ensure the destination root exists (handles the edge case where the source
  // tree is completely empty).
  await Filesystem.mkdir({
    path: destDir,
    directory: Directory.Data,
    recursive: true,
  });

  const walkResult: WalkResult = { files: [], directories: [] };

  // Recursively walk + copy.
  await walkAndCopy(sourceDir, destDir, '', walkResult);

  // Sort ascending by path.
  walkResult.files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  walkResult.directories.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const totalBytes = walkResult.files.reduce((sum, f) => sum + f.size, 0);

  const manifest: ExportManifest = {
    files: walkResult.files,
    directories: walkResult.directories,
    totalFiles: walkResult.files.length,
    totalBytes,
  };

  // Persist the manifest as UTF-8 JSON.
  await Filesystem.writeFile({
    path: manifestPath,
    data: JSON.stringify(manifest, null, 2),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  return manifest;
}

// ---------------------------------------------------------------------------
// Window exposure
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    CapacitorFilesystem: {
      Filesystem: typeof Filesystem;
      Directory: typeof Directory;
      Encoding: typeof Encoding;
    };
    runDirectoryExport: (options: ExportOptions) => Promise<ExportManifest>;
  }
}

window.CapacitorFilesystem = { Filesystem, Directory, Encoding };
window.runDirectoryExport = runDirectoryExport;

export {};