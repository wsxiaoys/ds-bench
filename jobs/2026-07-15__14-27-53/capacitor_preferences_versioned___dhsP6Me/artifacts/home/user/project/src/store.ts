import { Preferences } from '@capacitor/preferences';

interface Envelope {
  version: number;
  data: any;
}

export interface VersionedStoreConfig {
  /** The Preferences key under which the envelope is stored. */
  key: string;
  /** The current schema version (a positive integer). */
  version: number;
  /**
   * Optional map whose entry keyed by integer `n` upgrades a data payload
   * from version `n` to version `n + 1`. Migrations are applied in ascending
   * order to take a payload from its stored version up to the store's
   * current version.
   */
  migrations?: Record<number, (data: any) => any>;
}

export interface VersionedStore {
  get(): Promise<any | null>;
  set(value: any): Promise<void>;
  remove(): Promise<void>;
}

/**
 * Create a small, reusable versioned JSON store backed by
 * `@capacitor/preferences`. Each Preferences value is stored as a JSON
 * envelope of the shape `{ version: number, data: any }`. On read, an
 * older envelope is run through the migration chain so the returned data
 * always matches the store's current version.
 */
export function createVersionedStore(
  config: VersionedStoreConfig,
): VersionedStore {
  const { key, version: currentVersion } = config;
  const migrations = config.migrations ?? {};

  async function readEnvelope(): Promise<Envelope | null> {
    const { value } = await Preferences.get({ key });
    if (value === null || value === undefined) {
      return null;
    }
    return JSON.parse(value) as Envelope;
  }

  async function writeEnvelope(envelope: Envelope): Promise<void> {
    await Preferences.set({ key, value: JSON.stringify(envelope) });
  }

  /**
   * Run the migration chain in ascending order from `from` up to (but not
   * including) `to`. Each entry in `migrations` keyed by `n` upgrades a
   * payload from version `n` to version `n + 1`, so we feed the output of
   * migration `n` into migration `n + 1`.
   */
  function runMigrations(data: any, from: number, to: number): any {
    let value = data;
    for (let v = from; v < to; v++) {
      const step = migrations[v];
      if (typeof step !== 'function') {
        throw new Error(
          `Missing migration from version ${v} to version ${v + 1}`,
        );
      }
      value = step(value);
    }
    return value;
  }

  return {
    async get(): Promise<any | null> {
      const envelope = await readEnvelope();

      // No value persisted yet.
      if (envelope === null) {
        return null;
      }

      // Already at the current version: return as-is, no writes.
      if (envelope.version === currentVersion) {
        return envelope.data;
      }

      // Newer than what this build of the app understands: refuse.
      if (envelope.version > currentVersion) {
        throw new Error(
          `Stored version ${envelope.version} is newer than the current version ${currentVersion}`,
        );
      }

      // Older: migrate up. The migration chain runs entirely in memory
      // first; only after it succeeds do we persist the upgraded envelope.
      // That way, if any migration throws, we propagate the error and the
      // original envelope in Preferences is left untouched.
      let upgradedData: any;
      try {
        upgradedData = runMigrations(envelope.data, envelope.version, currentVersion);
      } catch (err) {
        // Re-throw so callers see the failure, but do NOT persist anything.
        throw err;
      }

      const upgradedEnvelope: Envelope = {
        version: currentVersion,
        data: upgradedData,
      };
      await writeEnvelope(upgradedEnvelope);
      return upgradedData;
    },

    async set(value: any): Promise<void> {
      const envelope: Envelope = { version: currentVersion, data: value };
      await writeEnvelope(envelope);
    },

    async remove(): Promise<void> {
      await Preferences.remove({ key });
    },
  };
}
