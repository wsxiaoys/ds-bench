// Storage migration demo app.
//
// Implements a one-time, idempotent migration that moves legacy
// `localStorage` entries (keys prefixed with `legacy:`) into
// `@capacitor/preferences`, and exposes it as `window.migrateStorage()`.
import { Preferences } from '@capacitor/preferences';

const LEGACY_PREFIX = 'legacy:';
const COMPLETION_FLAG_KEY = '__storage_migration_completed__';

export interface MigrationReport {
  alreadyCompleted: boolean;
  migrated: string[];
  skipped: string[];
}

/**
 * Migrate legacy `localStorage` entries (keys prefixed with `legacy:`)
 * into Capacitor Preferences.
 *
 * - Only `legacy:`-prefixed keys are considered. The destination key is the
 *   legacy key with the `legacy:` prefix removed.
 * - If a destination key already has a value in Preferences, it is skipped
 *   (never overwritten) and its `legacy:` entry is left untouched.
 * - Successfully migrated entries are removed from `localStorage`.
 * - Idempotent: a completion flag persisted through Preferences ensures the
 *   migration only runs once. Subsequent calls return `alreadyCompleted: true`
 *   with empty `migrated`/`skipped` arrays.
 *
 * @returns A report describing what happened during this call.
 */
async function migrateStorage(): Promise<MigrationReport> {
  const emptyReport: MigrationReport = {
    alreadyCompleted: false,
    migrated: [],
    skipped: [],
  };

  // Check the persisted completion flag first.
  const { value: completionFlag } = await Preferences.get({
    key: COMPLETION_FLAG_KEY,
  });
  if (completionFlag != null) {
    return {
      alreadyCompleted: true,
      migrated: [],
      skipped: [],
    };
  }

  const report: MigrationReport = { ...emptyReport };

  // Snapshot the legacy keys so we can safely mutate localStorage while iterating.
  const legacyKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key != null && key.startsWith(LEGACY_PREFIX)) {
      legacyKeys.push(key);
    }
  }

  for (const legacyKey of legacyKeys) {
    const destKey = legacyKey.slice(LEGACY_PREFIX.length);

    // Conflict check: never overwrite an existing Preferences value.
    const { value: existing } = await Preferences.get({ key: destKey });
    if (existing != null) {
      report.skipped.push(destKey);
      continue;
    }

    const legacyValue = window.localStorage.getItem(legacyKey);
    if (legacyValue != null) {
      await Preferences.set({ key: destKey, value: legacyValue });
    } else {
      // Edge case: the value disappeared between snapshot and read. Treat as
      // migrated (destination written with the value we have) but guard the set.
      await Preferences.set({ key: destKey, value: '' });
    }

    // Remove the legacy entry only after a successful write.
    window.localStorage.removeItem(legacyKey);
    report.migrated.push(destKey);
  }

  // Persist the completion flag so the migration never runs again.
  await Preferences.set({ key: COMPLETION_FLAG_KEY, value: 'true' });

  return report;
}

// Expose for the verifier / console usage.
(window as unknown as { migrateStorage: typeof migrateStorage }).migrateStorage =
  migrateStorage;

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.textContent = 'Storage migration demo';
}