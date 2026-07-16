import { Preferences } from '@capacitor/preferences';

interface MigrationReport {
  alreadyCompleted: boolean;
  migrated: string[];
  skipped: string[];
}

declare global {
  interface Window {
    migrateStorage: () => Promise<MigrationReport>;
  }
}

export async function migrateStorage(): Promise<MigrationReport> {
  // Check completion flag in Preferences
  const { value: completed } = await Preferences.get({ key: 'migration_completed' });
  if (completed === 'true') {
    return {
      alreadyCompleted: true,
      migrated: [],
      skipped: [],
    };
  }

  const migrated: string[] = [];
  const skipped: string[] = [];

  // Collect all legacy keys from localStorage
  const legacyKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith('legacy:')) {
      legacyKeys.push(key);
    }
  }

  // Sort keys to ensure deterministic processing order
  legacyKeys.sort();

  for (const key of legacyKeys) {
    const destKey = key.slice('legacy:'.length);
    
    // Check if destKey already has a value in Preferences
    const { value: existingValue } = await Preferences.get({ key: destKey });
    if (existingValue !== null) {
      skipped.push(destKey);
    } else {
      const legacyValue = window.localStorage.getItem(key);
      if (legacyValue !== null) {
        await Preferences.set({ key: destKey, value: legacyValue });
        window.localStorage.removeItem(key);
        migrated.push(destKey);
      }
    }
  }

  // Mark migration as completed in Preferences
  await Preferences.set({ key: 'migration_completed', value: 'true' });

  return {
    alreadyCompleted: false,
    migrated,
    skipped,
  };
}

// Expose the function globally
(window as any).migrateStorage = migrateStorage;

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.textContent = 'Storage migration demo';
}
