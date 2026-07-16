// Rolling file logger backed by @capacitor/filesystem (web implementation / IndexedDB).
//
// Storage layout under Directory.Data:
//   logs/app.log        <- active file (newest records)
//   logs/app.1.log      <- most recently rotated archive
//   logs/app.2.log      <- next older archive
//   logs/app.N.log      <- older archives; larger indices are older
//
// The active file is rotated whenever appending the next record would push
// the active file past the configured byte threshold. Rotation happens before
// writing so a single record is never split across files.

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

interface ArchiveInfo {
  name: string;
  size: number;
}

interface RollingLogAPI {
  configure(opts: { maxBytes: number; maxArchives: number }): Promise<void>;
  append(line: string): Promise<void>;
  readAll(): Promise<string[]>;
  archives(): Promise<ArchiveInfo[]>;
}

const LOG_DIR = 'logs';
const ACTIVE_FILE = 'app.log';
const ARCHIVE_PATTERN = /^app\.(\d+)\.log$/;

let maxBytes = 0;
let maxArchives = 0;

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

async function listLogDir(): Promise<Array<{ name: string; size: number; type: string }>> {
  try {
    const result = await Filesystem.readdir({
      path: LOG_DIR,
      directory: Directory.Data,
    });
    return result.files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    }));
  } catch {
    return [];
  }
}

async function tryStatSize(path: string): Promise<number | null> {
  try {
    const stat = await Filesystem.stat({
      path,
      directory: Directory.Data,
    });
    return stat.size;
  } catch {
    return null;
  }
}

async function readTextFile(path: string): Promise<string | null> {
  try {
    const result = await Filesystem.readFile({
      path,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return typeof result.data === 'string' ? result.data : '';
  } catch {
    return null;
  }
}

async function safeDelete(path: string): Promise<void> {
  try {
    await Filesystem.deleteFile({
      path,
      directory: Directory.Data,
    });
  } catch {
    // ignore - file may not exist
  }
}

async function renameInLogs(fromName: string, toName: string): Promise<void> {
  await Filesystem.rename({
    from: `${LOG_DIR}/${fromName}`,
    to: `${LOG_DIR}/${toName}`,
    directory: Directory.Data,
  });
}

async function deleteInLogs(name: string): Promise<void> {
  await safeDelete(`${LOG_DIR}/${name}`);
}

function splitLines(content: string): string[] {
  // Spec: "with trailing newlines stripped and no empty entries".
  return content.split('\n').filter((line) => line.length > 0);
}

async function rotate(): Promise<void> {
  // Discover existing archive indices (e.g. 1, 2, 3) in ascending order.
  const entries = await listLogDir();
  const indices: number[] = [];
  for (const entry of entries) {
    const match = entry.name.match(ARCHIVE_PATTERN);
    if (match) {
      indices.push(Number(match[1]));
    }
  }
  indices.sort((a, b) => a - b);

  // Keep at most (maxArchives - 1) existing archives so that after we move
  // app.log -> app.1.log we end up with at most maxArchives archives total.
  const keepCount = Math.max(0, maxArchives - 1);
  const keep = indices.slice(0, keepCount);
  const keepSet = new Set(keep);

  // Drop the oldest archives (highest indices) that would otherwise push us
  // past the configured limit.
  for (const idx of indices) {
    if (!keepSet.has(idx)) {
      await deleteInLogs(`app.${idx}.log`);
    }
  }

  // Shift remaining archives up by one in descending order so we never
  // overwrite a slot we still need.
  const shifted = [...keep].sort((a, b) => b - a);
  for (const idx of shifted) {
    await renameInLogs(`app.${idx}.log`, `app.${idx + 1}.log`);
  }

  // Finally, move the active file to app.1.log.
  await renameInLogs(ACTIVE_FILE, 'app.1.log');
}

const rollingLog: RollingLogAPI = {
  async configure({ maxBytes: mb, maxArchives: ma }) {
    if (typeof mb !== 'number' || !Number.isFinite(mb) || mb <= 0) {
      throw new Error('maxBytes must be a positive number');
    }
    if (typeof ma !== 'number' || !Number.isInteger(ma) || ma < 0) {
      throw new Error('maxArchives must be a non-negative integer');
    }
    maxBytes = mb;
    maxArchives = ma;

    // Clear any existing log files for a fresh start.
    const entries = await listLogDir();
    for (const entry of entries) {
      if (entry.type === 'file') {
        await deleteInLogs(entry.name);
      }
    }
  },

  async append(line) {
    const text = String(line ?? '');
    const record = text + '\n';
    const newBytes = utf8ByteLength(record);

    const activePath = `${LOG_DIR}/${ACTIVE_FILE}`;
    const currentSize = await tryStatSize(activePath);

    // Rotate first if appending would push the active file past the
    // threshold. The very first record (no active file yet) is always
    // written without rotating, even if it alone exceeds the threshold.
    if (currentSize !== null && currentSize + newBytes > maxBytes) {
      await rotate();
    }

    // appendFile on the web implementation creates the parent directory
    // recursively if it does not yet exist, so we don't need an explicit
    // mkdir before this call.
    await Filesystem.appendFile({
      path: activePath,
      data: record,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  },

  async readAll() {
    const entries = await listLogDir();

    const archiveIndices: number[] = [];
    let hasActive = false;
    for (const entry of entries) {
      if (entry.name === ACTIVE_FILE && entry.type === 'file') {
        hasActive = true;
        continue;
      }
      const match = entry.name.match(ARCHIVE_PATTERN);
      if (match && entry.type === 'file') {
        archiveIndices.push(Number(match[1]));
      }
    }

    // Older archives come first: app.N.log with larger N is older, app.1.log
    // is the most recently rotated archive, app.log is the active newest.
    archiveIndices.sort((a, b) => b - a);

    const lines: string[] = [];
    for (const idx of archiveIndices) {
      const content = await readTextFile(`${LOG_DIR}/app.${idx}.log`);
      if (content !== null) {
        lines.push(...splitLines(content));
      }
    }
    if (hasActive) {
      const content = await readTextFile(`${LOG_DIR}/${ACTIVE_FILE}`);
      if (content !== null) {
        lines.push(...splitLines(content));
      }
    }
    return lines;
  },

  async archives() {
    const entries = await listLogDir();
    const result: ArchiveInfo[] = [];
    for (const entry of entries) {
      const match = entry.name.match(ARCHIVE_PATTERN);
      if (match && entry.type === 'file') {
        result.push({ name: entry.name, size: entry.size });
      }
    }
    return result;
  },
};

declare global {
  interface Window {
    rollingLog: RollingLogAPI;
  }
}

window.rollingLog = rollingLog;

export {};
