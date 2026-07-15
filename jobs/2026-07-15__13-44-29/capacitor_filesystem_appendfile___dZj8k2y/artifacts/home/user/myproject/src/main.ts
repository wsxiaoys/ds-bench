import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

// Configuration keys and defaults
const CONFIG_KEY = 'rolling_logger_config';
let maxBytes = 1024 * 1024; // Default 1MB
let maxArchives = 5; // Default 5 archives

// Load persisted configuration on page load (without deleting any existing logs)
const savedConfig = localStorage.getItem(CONFIG_KEY);
if (savedConfig) {
  try {
    const parsed = JSON.parse(savedConfig);
    if (typeof parsed.maxBytes === 'number') maxBytes = parsed.maxBytes;
    if (typeof parsed.maxArchives === 'number') maxArchives = parsed.maxArchives;
  } catch (e) {
    // Ignore invalid JSON
  }
}

// Queue to serialize all operations and prevent race conditions
class TaskQueue {
  private promise: Promise<any> = Promise.resolve();

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const nextPromise = this.promise.then(() => task());
    this.promise = nextPromise.catch(() => {});
    return nextPromise;
  }
}

const queue = new TaskQueue();

// Ensure the logs directory exists
async function ensureLogsDir(): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: 'logs',
      directory: Directory.Data,
      recursive: true,
    });
  } catch (e) {
    // Ignore error if the directory already exists
  }
}

/**
 * Configure the rolling file logger.
 * Sets the byte threshold and the number of archive files to retain,
 * and clears any existing log files for a fresh start.
 */
async function configure(options: { maxBytes: number; maxArchives: number }): Promise<void> {
  return queue.enqueue(async () => {
    maxBytes = options.maxBytes;
    maxArchives = options.maxArchives;
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ maxBytes, maxArchives }));

    // Clear existing logs
    try {
      await Filesystem.rmdir({
        path: 'logs',
        directory: Directory.Data,
        recursive: true,
      });
    } catch (e) {
      // Ignore if directory doesn't exist
    }

    // Recreate logs directory
    await ensureLogsDir();
  });
}

/**
 * Append one record, rotating first if needed.
 * A single record is never split across two files.
 */
async function append(line: string): Promise<void> {
  return queue.enqueue(async () => {
    await ensureLogsDir();

    const record = line + '\n';
    const recordBytes = new TextEncoder().encode(record).length;

    let activeExists = false;
    let activeSize = 0;

    try {
      const info = await Filesystem.stat({
        path: 'logs/app.log',
        directory: Directory.Data,
      });
      activeExists = true;
      activeSize = info.size;
    } catch (e) {
      // Active file does not exist yet
    }

    // Rotation must run BEFORE writing a record:
    // If the active file already exists and its current size plus the UTF-8 byte length
    // of the new record exceeds the configured threshold, rotate first.
    if (activeExists && (activeSize + recordBytes > maxBytes)) {
      const dirInfo = await Filesystem.readdir({
        path: 'logs',
        directory: Directory.Data,
      });
      const existingFiles = new Set(dirInfo.files.map((f) => f.name));

      if (maxArchives > 0) {
        // Delete the archive that would exceed the limit (the oldest, i.e., app.maxArchives.log)
        if (existingFiles.has(`app.${maxArchives}.log`)) {
          await Filesystem.deleteFile({
            path: `logs/app.${maxArchives}.log`,
            directory: Directory.Data,
          });
        }

        // Shift the remaining archives up by one
        for (let i = maxArchives - 1; i >= 1; i--) {
          if (existingFiles.has(`app.${i}.log`)) {
            await Filesystem.rename({
              from: `logs/app.${i}.log`,
              to: `logs/app.${i + 1}.log`,
              directory: Directory.Data,
              toDirectory: Directory.Data,
            });
          }
        }

        // Move app.log to app.1.log
        await Filesystem.rename({
          from: 'logs/app.log',
          to: 'logs/app.1.log',
          directory: Directory.Data,
          toDirectory: Directory.Data,
        });
      } else {
        // If maxArchives is 0, we just delete the active log file
        await Filesystem.deleteFile({
          path: 'logs/app.log',
          directory: Directory.Data,
        });
      }
    }

    // Append the record to the active file
    await Filesystem.appendFile({
      path: 'logs/app.log',
      data: record,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  });
}

/**
 * Return every retained line in chronological order (oldest first) across all files,
 * with trailing newlines stripped and no empty entries.
 */
async function readAll(): Promise<string[]> {
  return queue.enqueue(async () => {
    await ensureLogsDir();

    const dirInfo = await Filesystem.readdir({
      path: 'logs',
      directory: Directory.Data,
    });
    const existingFiles = new Set(dirInfo.files.map((f) => f.name));

    const filesToRead: string[] = [];

    // Rotated archives: app.maxArchives.log down to app.1.log (oldest to newest)
    for (let i = maxArchives; i >= 1; i--) {
      if (existingFiles.has(`app.${i}.log`)) {
        filesToRead.push(`app.${i}.log`);
      }
    }

    // Active file is the newest
    if (existingFiles.has('app.log')) {
      filesToRead.push('app.log');
    }

    const lines: string[] = [];

    for (const fileName of filesToRead) {
      try {
        const result = await Filesystem.readFile({
          path: `logs/${fileName}`,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });

        const content = typeof result.data === 'string' ? result.data : '';
        if (content) {
          const fileLines = content.split(/\r?\n/);
          for (const line of fileLines) {
            if (line !== '') {
              lines.push(line);
            }
          }
        }
      } catch (e) {
        // Ignore individual read errors to remain robust
      }
    }

    return lines;
  });
}

/**
 * Return an array of { name, size } objects for the archive files that currently exist
 * (excluding the active app.log), where size is the file size in bytes.
 */
async function archives(): Promise<{ name: string; size: number }[]> {
  return queue.enqueue(async () => {
    await ensureLogsDir();

    const dirInfo = await Filesystem.readdir({
      path: 'logs',
      directory: Directory.Data,
    });

    return dirInfo.files
      .filter((f) => f.type === 'file' && f.name !== 'app.log' && /^app\.\d+\.log$/.test(f.name))
      .map((f) => ({
        name: f.name,
        size: f.size,
      }));
  });
}

// Expose rollingLog globally
const rollingLog = {
  configure,
  append,
  readAll,
  archives,
};

(window as any).rollingLog = rollingLog;

export { configure, append, readAll, archives };
