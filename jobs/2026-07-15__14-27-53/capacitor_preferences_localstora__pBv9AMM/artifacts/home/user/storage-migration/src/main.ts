// Storage migration demo entry point.
//
// Implements a one-time, idempotent migration that moves legacy
// `localStorage` entries (keys prefixed with `legacy:`) into
// `@capacitor/preferences`, and exposes it as `window.migrateStorage()`.
import { Preferences } from '@capacitor/preferences';

// Declare the global function shape so TypeScript is happy.
declare global {
  interface Window {
    migrateStorage: () => Promise<MigrationReport>;
  }
}

interface MigrationReport {
  alreadyCompleted: boolean;
  migrated: string[];
  skipped: string[];
}

const LEGACY_PREFIX = 'legacy:';
const COMPLETION_FLAG_KEY = 'migration:legacy-to-preferences:completed';

async function migrateStorage(): Promise<MigrationReport> {
  const migrated: string[] = [];
  const skipped: string[] = [];

  // Idempotency guard: once the completion flag is set in Preferences, do nothing.
  const completionFlag = await Preferences.get({ key: COMPLETION_FLAG_KEY });
  if (completionFlag.value === 'true') {
    return {
      alreadyCompleted: true,
      migrated,
      skipped,
    };
  }

  // Snapshot all `legacy:`-prefixed keys currently in `localStorage`.
  const legacyKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key !== null && key.startsWith(LEGACY_PREFIX)) {
      legacyKeys.push(key);
    }
  }

  for (const legacyKey of legacyKeys) {
    const destinationKey = legacyKey.substring(LEGACY_PREFIX.length);

    // Defensive: skip anything that would yield an empty destination key.
    if (destinationKey.length === 0) {
      continue;
    }

    // Conflict resolution: skip when the destination already has a value
    // in Preferences. The legacy entry must be left untouched in this case.
    const existing = await Preferences.get({ key: destinationKey });
    if (existing.value !== null) {
      skipped.push(destinationKey);
      continue;
    }

    // Read the legacy value from `localStorage` and persist it to Preferences.
    const value = window.localStorage.getItem(legacyKey);
    if (value === null) {
      // Value disappeared between snapshot and read; nothing to do.
      continue;
    }

    await Preferences.set({ key: destinationKey, value });

    // Remove the successfully migrated entry from `localStorage`.
    window.localStorage.removeItem(legacyKey);
    migrated.push(destinationKey);
  }

  // Mark migration as complete so subsequent calls become no-ops.
  await Preferences.set({ key: COMPLETION_FLAG_KEY, value: 'true' });

  return {
    alreadyCompleted: false,
    migrated,
    skipped,
  };
}

window.migrateStorage = migrateStorage;

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.textContent = 'Storage migration demo';
}
