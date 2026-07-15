import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

/**
 * Rolling file logger backed by @capacitor/filesystem (web implementation,
 * which uses IndexedDB). Appends log lines to an active file (`app.log`) and
 * rotates it into a bounded set of archives (`app.1.log`, `app.2.log`, ...)
 * once the active file would grow past a configurable byte threshold.
 *
 * Archive numbering: `app.1.log` is the most recently rotated file, larger
 * indices are older. Only `maxArchives` archives are retained; older data is
 * discarded.
 */

const LOG_DIR = 'logs';
const ACTIVE_NAME = 'app.log';

function archiveName(index: number): string {
  return `app.${index}.log`;
}

/** UTF-8 byte length of a string (not the UTF-16 `.length`). */
function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

interface ArchiveInfo {
  name: string;
  size: number;
}

interface DirEntry {
  name: string;
  size: number;
}

class RollingLog {
  private maxBytes = 1024 * 1024;
  private maxArchives = 3;

  /** Configure thresholds and clear any existing log files for a fresh start. */
  async configure(opts: { maxBytes: number; maxArchives: number }): Promise<void> {
    this.maxBytes = opts.maxBytes;
    this.maxArchives = opts.maxArchives;
    await this.clearLogFiles();
  }

  /** Append one record, rotating first if the active file would exceed the threshold. */
  async append(line: string): Promise<void> {
    const record = line + '\n';
    const recordBytes = utf8ByteLength(record);
    const activePath = `${LOG_DIR}/${ACTIVE_NAME}`;

    if (await this.pathExists(activePath)) {
      const stat = await Filesystem.stat({
        path: activePath,
        directory: Directory.Data,
      });
      if (stat.size + recordBytes > this.maxBytes) {
        await this.rotate();
      }
    }

    await Filesystem.appendFile({
      path: activePath,
      data: record,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  }

  /** Return every retained line in chronological order (oldest first). */
  async readAll(): Promise<string[]> {
    const lines: string[] = [];

    // Archives: higher index == older. Read oldest first.
    const indices = await this.listArchiveIndices();
    indices.sort((a, b) => b - a);
    for (const i of indices) {
      const content = await this.readFileText(`${LOG_DIR}/${archiveName(i)}`);
      this.collectLines(content, lines);
    }

    // Active file is the newest, read last.
    const activeContent = await this.readFileText(`${LOG_DIR}/${ACTIVE_NAME}`);
    this.collectLines(activeContent, lines);

    return lines;
  }

  /** Return `{ name, size }` for each archive file that currently exists. */
  async archives(): Promise<ArchiveInfo[]> {
    const files = await this.readLogDir();
    const result: ArchiveInfo[] = [];
    for (const f of files) {
      if (/^app\.\d+\.log$/.test(f.name)) {
        result.push({ name: f.name, size: f.size });
      }
    }
    return result;
  }

  // ---- helpers -----------------------------------------------------------

  private collectLines(content: string, out: string[]): void {
    if (!content) return;
    const parts = content.split('\n');
    for (const p of parts) {
      if (p !== '') out.push(p);
    }
  }

  private async clearLogFiles(): Promise<void> {
    const files = await this.readLogDir();
    for (const f of files) {
      await Filesystem.deleteFile({
        path: `${LOG_DIR}/${f.name}`,
        directory: Directory.Data,
      });
    }
  }

  private async readLogDir(): Promise<DirEntry[]> {
    try {
      const res = await Filesystem.readdir({
        path: LOG_DIR,
        directory: Directory.Data,
      });
      return res.files.map((f) => ({ name: f.name, size: f.size }));
    } catch (e) {
      // Folder does not exist yet.
      return [];
    }
  }

  private async listArchiveIndices(): Promise<number[]> {
    const files = await this.readLogDir();
    const indices: number[] = [];
    for (const f of files) {
      const m = f.name.match(/^app\.(\d+)\.log$/);
      if (m) indices.push(parseInt(m[1], 10));
    }
    return indices;
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await Filesystem.stat({ path, directory: Directory.Data });
      return true;
    } catch (e) {
      return false;
    }
  }

  private async readFileText(path: string): Promise<string> {
    try {
      const res = await Filesystem.readFile({
        path,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return typeof res.data === 'string' ? res.data : '';
    } catch (e) {
      return '';
    }
  }

  /**
   * Rotate the active file into the archive chain.
   *
   * 1. Delete the oldest archive(s) that would exceed `maxArchives`.
   * 2. Shift the remaining archives up by one index (descending order so we
   *    never overwrite a file we still need to move).
   * 3. Move `app.log` -> `app.1.log`.
   */
  private async rotate(): Promise<void> {
    if (this.maxArchives <= 0) {
      // No archives retained: discard everything.
      const indices = await this.listArchiveIndices();
      for (const i of indices) {
        await Filesystem.deleteFile({
          path: `${LOG_DIR}/${archiveName(i)}`,
          directory: Directory.Data,
        });
      }
      const activePath = `${LOG_DIR}/${ACTIVE_NAME}`;
      if (await this.pathExists(activePath)) {
        await Filesystem.deleteFile({
          path: activePath,
          directory: Directory.Data,
        });
      }
      return;
    }

    let indices = await this.listArchiveIndices();
    indices.sort((a, b) => a - b);

    // After rotation we will have (indices.length - deletions) + 1 archives.
    // Keep that at most maxArchives.
    const deletions = Math.max(0, indices.length + 1 - this.maxArchives);
    for (let d = 0; d < deletions; d++) {
      const oldest = indices.pop()!;
      await Filesystem.deleteFile({
        path: `${LOG_DIR}/${archiveName(oldest)}`,
        directory: Directory.Data,
      });
    }

    // Shift remaining archives up by one (highest index first).
    for (let k = indices.length - 1; k >= 0; k--) {
      const i = indices[k];
      await Filesystem.rename({
        from: `${LOG_DIR}/${archiveName(i)}`,
        to: `${LOG_DIR}/${archiveName(i + 1)}`,
        directory: Directory.Data,
      });
    }

    // Move the active file into the most-recent archive slot.
    const activePath = `${LOG_DIR}/${ACTIVE_NAME}`;
    if (await this.pathExists(activePath)) {
      await Filesystem.rename({
        from: activePath,
        to: `${LOG_DIR}/${archiveName(1)}`,
        directory: Directory.Data,
      });
    }
  }
}

const logger = new RollingLog();
(window as unknown as { rollingLog: RollingLog }).rollingLog = logger;

console.log('rollingLog ready');