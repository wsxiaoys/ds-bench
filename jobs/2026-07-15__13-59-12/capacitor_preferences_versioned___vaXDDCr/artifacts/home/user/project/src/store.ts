import { Preferences } from '@capacitor/preferences';

/**
 * A migration function upgrades a data payload from version `n` to version
 * `n + 1`. The entry keyed by integer `n` in the `migrations` map transforms a
 * payload whose envelope version is `n` into the shape expected at version
 * `n + 1`.
 */
export type Migration = (data: any) => any;

/**
 * Configuration accepted by {@link createVersionedStore}.
 */
export interface VersionedStoreConfig {
  /** The Preferences key under which the envelope is stored. */
  key: string;
  /** The current schema version (a positive integer). */
  version: number;
  /**
   * Optional map whose entry keyed by integer `n` upgrades a data payload from
   * version `n` to version `n + 1`.
   */
  migrations?: Record<number, Migration>;
}

/**
 * The envelope persisted to Preferences. It carries the schema version
 * alongside the user data so that older payloads can be upgraded on read.
 */
interface Envelope {
  version: number;
  data: any;
}

/**
 * The store object returned by {@link createVersionedStore}.
 */
export interface VersionedStore {
  get(): Promise<any | null>;
  set(value: any): Promise<void>;
  remove(): Promise<void>;
}

/**
 * Create a small, reusable versioned JSON store on top of
 * `@capacitor/preferences`.
 *
 * Every value is persisted as a JSON string of an envelope object with exactly
 * two top-level keys: `version` (number) and `data` (the user value).
 *
 * On read, if the stored envelope's version is less than the store's current
 * version the migration chain is applied in ascending order and the upgraded
 * envelope is persisted back so the migration only happens once. If a
 * migration function throws, `get()` rejects and the stored value is left
 * exactly as it was (the upgrade is atomic).
 */
export function createVersionedStore(config: VersionedStoreConfig): VersionedStore {
  const { key, version, migrations = {} } = config;

  /**
   * Apply the migration chain that upgrades `data` from `fromVersion` up to
   * `toVersion`. The migration keyed by integer `n` upgrades from version `n`
   * to version `n + 1`, so we apply entries for `fromVersion, fromVersion + 1,
   * ..., toVersion - 1` in ascending order, feeding the output of one into the
   * next.
   *
   * If any migration function throws the error propagates and nothing has been
   * persisted yet, leaving the stored value untouched.
   */
  const runMigrations = (data: any, fromVersion: number, toVersion: number): any => {
    let current = data;
    for (let v = fromVersion; v < toVersion; v++) {
      const migrate = migrations[v];
      if (typeof migrate === 'function') {
        current = migrate(current);
      }
    }
    return current;
  };

  return {
    async get(): Promise<any | null> {
      const { value } = await Preferences.get({ key });

      // Key does not exist in Preferences.
      if (value === null) {
        return null;
      }

      const envelope: Envelope = JSON.parse(value);
      const storedVersion = envelope.version;
      const storedData = envelope.data;

      // Stored version matches the current schema: return data unchanged.
      if (storedVersion === version) {
        return storedData;
      }

      // Stored version is newer than the store can understand: reject.
      if (storedVersion > version) {
        throw new Error(
          `Stored version ${storedVersion} is greater than the current version ${version}`,
        );
      }

      // Stored version is older: run the migration chain.
      // The upgrade is atomic — we only persist after every migration
      // succeeds. If any migration throws, we propagate the error before
      // touching Preferences, leaving the original envelope intact.
      const upgradedData = runMigrations(storedData, storedVersion, version);
      const upgradedEnvelope: Envelope = { version, data: upgradedData };
      await Preferences.set({ key, value: JSON.stringify(upgradedEnvelope) });

      return upgradedData;
    },

    async set(value: any): Promise<void> {
      const envelope: Envelope = { version, data: value };
      await Preferences.set({ key, value: JSON.stringify(envelope) });
    },

    async remove(): Promise<void> {
      await Preferences.remove({ key });
    },
  };
}