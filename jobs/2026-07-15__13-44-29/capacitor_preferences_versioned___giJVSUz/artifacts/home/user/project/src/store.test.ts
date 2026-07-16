// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createVersionedStore } from './store';
import { Preferences } from '@capacitor/preferences';

// Setup Mock for @capacitor/preferences
const mockStorage = new Map<string, string>();

vi.mock('@capacitor/preferences', () => {
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => {
        return { value: mockStorage.get(key) ?? null };
      }),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
        mockStorage.set(key, value);
      }),
      remove: vi.fn(async ({ key }: { key: string }) => {
        mockStorage.delete(key);
      }),
      clear: vi.fn(async () => {
        mockStorage.clear();
      }),
    },
  };
});

describe('createVersionedStore', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  describe('Configuration validation', () => {
    it('should throw if key is not a non-empty string', () => {
      expect(() => createVersionedStore({ key: '', version: 1 })).toThrow();
      expect(() => createVersionedStore({ key: 123 as any, version: 1 })).toThrow();
    });

    it('should throw if version is not a positive integer', () => {
      expect(() => createVersionedStore({ key: 'test', version: 0 })).toThrow();
      expect(() => createVersionedStore({ key: 'test', version: -1 })).toThrow();
      expect(() => createVersionedStore({ key: 'test', version: 1.5 })).toThrow();
      expect(() => createVersionedStore({ key: 'test', version: '1' as any })).toThrow();
    });
  });

  describe('Basic operations (get, set, remove)', () => {
    it('should return null when key does not exist', async () => {
      const store = createVersionedStore({ key: 'my-store', version: 1 });
      const val = await store.get();
      expect(val).toBeNull();
      expect(Preferences.get).toHaveBeenCalledWith({ key: 'my-store' });
    });

    it('should persist value with current version on set()', async () => {
      const store = createVersionedStore({ key: 'my-store', version: 2 });
      await store.set({ foo: 'bar' });

      expect(Preferences.set).toHaveBeenCalled();
      const storedRaw = mockStorage.get('my-store');
      expect(storedRaw).toBeDefined();

      const parsed = JSON.parse(storedRaw!);
      expect(parsed).toEqual({
        version: 2,
        data: { foo: 'bar' },
      });
    });

    it('should get persisted value unchanged when version matches', async () => {
      const store = createVersionedStore({ key: 'my-store', version: 3 });
      await store.set({ hello: 'world' });

      vi.clearAllMocks();

      const val = await store.get();
      expect(val).toEqual({ hello: 'world' });
      expect(Preferences.get).toHaveBeenCalledWith({ key: 'my-store' });
      // Since version matched, set should NOT be called on get
      expect(Preferences.set).not.toHaveBeenCalled();
    });

    it('should remove value successfully', async () => {
      const store = createVersionedStore({ key: 'my-store', version: 1 });
      await store.set('some-data');
      expect(mockStorage.has('my-store')).toBe(true);

      await store.remove();
      expect(mockStorage.has('my-store')).toBe(false);
      expect(Preferences.remove).toHaveBeenCalledWith({ key: 'my-store' });

      const val = await store.get();
      expect(val).toBeNull();
    });
  });

  describe('Migrations', () => {
    it('should run migrations from older version to current version and persist the upgraded envelope', async () => {
      // Manually seed an older version (v1) in the mock storage
      const initialEnvelope = {
        version: 1,
        data: { username: 'john_doe' },
      };
      mockStorage.set('user-store', JSON.stringify(initialEnvelope));

      const migrations = {
        1: (data: any) => {
          return { ...data, step1: true };
        },
        2: (data: any) => {
          return { ...data, step2: true, name: data.username.toUpperCase() };
        },
      };

      const store = createVersionedStore({
        key: 'user-store',
        version: 3,
        migrations,
      });

      vi.clearAllMocks();

      const upgradedData = await store.get();

      // Verify returned data is fully migrated
      expect(upgradedData).toEqual({
        username: 'john_doe',
        step1: true,
        step2: true,
        name: 'JOHN_DOE',
      });

      // Verify the newly upgraded envelope is persisted back to Preferences
      expect(Preferences.set).toHaveBeenCalled();
      const storedRaw = mockStorage.get('user-store');
      expect(storedRaw).toBeDefined();

      const parsed = JSON.parse(storedRaw!);
      expect(parsed).toEqual({
        version: 3,
        data: {
          username: 'john_doe',
          step1: true,
          step2: true,
          name: 'JOHN_DOE',
        },
      });
    });

    it('should throw and not modify the stored value if a migration function in the chain is missing', async () => {
      const initialEnvelope = {
        version: 1,
        data: { count: 10 },
      };
      mockStorage.set('counter-store', JSON.stringify(initialEnvelope));

      const store = createVersionedStore({
        key: 'counter-store',
        version: 3,
        migrations: {
          // missing migration for version 2
          1: (data: any) => ({ count: data.count + 1 }),
        },
      });

      await expect(store.get()).rejects.toThrow(/Migration function for version 2.*missing/);

      // Ensure the store is not updated
      const storedRaw = mockStorage.get('counter-store');
      expect(JSON.parse(storedRaw!)).toEqual(initialEnvelope);
    });

    it('should throw and leave stored value intact if any migration function throws', async () => {
      const initialEnvelope = {
        version: 1,
        data: { val: 'start' },
      };
      mockStorage.set('error-store', JSON.stringify(initialEnvelope));

      const store = createVersionedStore({
        key: 'error-store',
        version: 3,
        migrations: {
          1: (data: any) => ({ val: data.val + '-v2' }),
          2: () => {
            throw new Error('Migration failed!');
          },
        },
      });

      await expect(store.get()).rejects.toThrow('Migration failed!');

      // Ensure the store is not updated (remains at v1)
      const storedRaw = mockStorage.get('error-store');
      expect(JSON.parse(storedRaw!)).toEqual(initialEnvelope);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should throw and not modify stored value if stored version is greater than current version', async () => {
      const futureEnvelope = {
        version: 5,
        data: { featureFlag: true },
      };
      mockStorage.set('feature-store', JSON.stringify(futureEnvelope));

      const store = createVersionedStore({
        key: 'feature-store',
        version: 3,
      });

      await expect(store.get()).rejects.toThrow(/Stored version \(5\) is greater than current version \(3\)/);

      // Verify stored value remains unchanged
      const storedRaw = mockStorage.get('feature-store');
      expect(JSON.parse(storedRaw!)).toEqual(futureEnvelope);
    });

    it('should throw if stored envelope is invalid JSON', async () => {
      mockStorage.set('bad-store', 'not-json-at-all');

      const store = createVersionedStore({
        key: 'bad-store',
        version: 1,
      });

      await expect(store.get()).rejects.toThrow(/Failed to parse stored envelope JSON/);
    });

    it('should throw if stored envelope is missing required keys', async () => {
      mockStorage.set('invalid-envelope-store', JSON.stringify({ data: 'no-version-key' }));

      const store = createVersionedStore({
        key: 'invalid-envelope-store',
        version: 2,
      });

      await expect(store.get()).rejects.toThrow(/Stored value is not a valid versioned envelope/);
    });
  });
});
