import { Preferences } from '@capacitor/preferences';

export interface VersionedStoreConfig<T = any> {
  key: string;
  version: number;
  migrations?: Record<number, (data: any) => any>;
}

export interface VersionedStore<T = any> {
  get(): Promise<T | null>;
  set(value: T): Promise<void>;
  remove(): Promise<void>;
}

interface Envelope<T> {
  version: number;
  data: T;
}

export function createVersionedStore<T = any>(
  config: VersionedStoreConfig<T>
): VersionedStore<T> {
  const { key, version: currentVersion, migrations } = config;

  if (typeof key !== 'string' || key.trim() === '') {
    throw new Error('Store key must be a non-empty string');
  }

  if (typeof currentVersion !== 'number' || currentVersion <= 0 || !Number.isInteger(currentVersion)) {
    throw new Error('Store version must be a positive integer');
  }

  return {
    async get(): Promise<T | null> {
      const { value } = await Preferences.get({ key });
      if (value === null) {
        return null;
      }

      let envelope: Envelope<any>;
      try {
        envelope = JSON.parse(value);
      } catch (err) {
        throw new Error(`Failed to parse stored envelope JSON: ${(err as Error).message}`);
      }

      if (
        envelope === null ||
        typeof envelope !== 'object' ||
        !('version' in envelope) ||
        !('data' in envelope)
      ) {
        throw new Error('Stored value is not a valid versioned envelope');
      }

      const storedVersion = envelope.version;
      let data = envelope.data;

      if (storedVersion === currentVersion) {
        return data as T;
      }

      if (storedVersion > currentVersion) {
        throw new Error(
          `Stored version (${storedVersion}) is greater than current version (${currentVersion})`
        );
      }

      // storedVersion < currentVersion: run migrations
      for (let v = storedVersion; v < currentVersion; v++) {
        const migrationFn = migrations?.[v];
        if (!migrationFn) {
          throw new Error(
            `Migration function for version ${v} (to version ${v + 1}) is missing`
          );
        }
        data = migrationFn(data);
      }

      // Persist the upgraded envelope back (stamped with the current version)
      const upgradedEnvelope: Envelope<T> = {
        version: currentVersion,
        data,
      };
      await Preferences.set({
        key,
        value: JSON.stringify(upgradedEnvelope),
      });

      return data as T;
    },

    async set(value: T): Promise<void> {
      const envelope: Envelope<T> = {
        version: currentVersion,
        data: value,
      };
      await Preferences.set({
        key,
        value: JSON.stringify(envelope),
      });
    },

    async remove(): Promise<void> {
      await Preferences.remove({ key });
    },
  };
}
