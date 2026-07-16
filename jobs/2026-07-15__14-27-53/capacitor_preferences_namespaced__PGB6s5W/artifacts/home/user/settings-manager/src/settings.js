import { Preferences } from '@capacitor/preferences';

/**
 * Fixed namespace schemas for the application. Each key in a namespace
 * declares its JavaScript type via the default value. Overrides stored in
 * Preferences must round-trip through JSON so primitive types are preserved.
 */
const SCHEMAS = Object.freeze({
  app: Object.freeze({
    theme: 'light',
    fontSize: 14,
    notifications: true,
  }),
  appearance: Object.freeze({
    theme: 'system',
    accent: 'blue',
  }),
  editor: Object.freeze({
    tabSize: 4,
    wordWrap: false,
  }),
});

/**
 * Key-encoding scheme:
 *
 *   Preferences key = `${PREFIX}${namespace}${DELIMITER}${settingKey}`
 *
 * The `::` delimiter is intentionally chosen so the namespace `app` cannot
 * accidentally match a key belonging to the namespace `appearance` (which
 * would happen with a simple `:` separator). The `settings:` prefix avoids
 * collisions with any non-namespaced Preferences keys that may exist.
 */
const PREFIX = 'settings:';
const DELIMITER = '::';

function encodeKey(namespace, key) {
  return `${PREFIX}${namespace}${DELIMITER}${key}`;
}

/**
 * Decode a Preferences key into `{ namespace, settingKey }`, or `null` if the
 * key is not one of ours. Splitting on the *first* `::` keeps the lookup
 * robust even if a namespace or setting key happened to contain colons.
 */
function decodeKey(rawKey) {
  if (typeof rawKey !== 'string' || !rawKey.startsWith(PREFIX)) {
    return null;
  }
  const rest = rawKey.slice(PREFIX.length);
  const idx = rest.indexOf(DELIMITER);
  if (idx < 0) {
    return null;
  }
  return {
    namespace: rest.slice(0, idx),
    settingKey: rest.slice(idx + DELIMITER.length),
  };
}

function hasOwn(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

function assertNamespace(namespace) {
  if (!hasOwn(SCHEMAS, namespace)) {
    throw new Error(`Unknown namespace: ${namespace}`);
  }
}

function assertKey(namespace, key) {
  if (!hasOwn(SCHEMAS[namespace], key)) {
    throw new Error(`Unknown setting key "${key}" for namespace "${namespace}"`);
  }
}

/**
 * List the setting keys that currently have a stored override in the given
 * namespace, restricted to keys defined in the schema. Returned sorted in
 * ascending alphabetical order.
 */
async function listOverriddenKeys(namespace) {
  const { keys } = await Preferences.keys();
  const schema = SCHEMAS[namespace];
  const result = [];
  for (const raw of keys) {
    const decoded = decodeKey(raw);
    if (!decoded || decoded.namespace !== namespace) {
      continue;
    }
    if (hasOwn(schema, decoded.settingKey)) {
      result.push(decoded.settingKey);
    }
  }
  result.sort();
  return result;
}

/**
 * Read the stored override for `(namespace, key)` and decode its JSON-encoded
 * value back into its original JavaScript type. Returns `null` when the key
 * has never been set.
 */
async function readOverride(namespace, key) {
  const fullKey = encodeKey(namespace, key);
  const { value } = await Preferences.get({ key: fullKey });
  if (value === null || value === undefined) {
    return null;
  }
  return JSON.parse(value);
}

export const settings = {
  /**
   * Resolve the effective value of `namespace.key` (stored override if any,
   * otherwise the schema default), preserving the value's JavaScript type.
   * Rejects when the namespace or key is not declared in a schema.
   */
  async get(namespace, key) {
    assertNamespace(namespace);
    assertKey(namespace, key);

    const override = await readOverride(namespace, key);
    if (override === null) {
      return SCHEMAS[namespace][key];
    }
    return override;
  },

  /**
   * Persist `value` under `(namespace, key)`. The value is JSON-encoded so it
   * can be reconstructed with its original JavaScript type on read. Rejects
   * when the namespace or key is not declared in a schema.
   */
  async set(namespace, key, value) {
    assertNamespace(namespace);
    assertKey(namespace, key);

    const fullKey = encodeKey(namespace, key);
    await Preferences.set({ key: fullKey, value: JSON.stringify(value) });
  },

  /**
   * Remove every stored override belonging to `namespace`. Other namespaces
   * (including ones whose name shares a textual prefix, e.g. `app` vs.
   * `appearance`) are completely untouched.
   */
  async reset(namespace) {
    assertNamespace(namespace);

    const { keys } = await Preferences.keys();
    const matching = keys.filter((raw) => {
      const decoded = decodeKey(raw);
      return decoded !== null && decoded.namespace === namespace;
    });

    // Use removeItems (a single round-trip) when available; otherwise fall
    // back to sequential remove() calls. Either way the operation is atomic
    // from the caller's perspective because Preferences is the backing store.
    if (typeof Preferences.removeItems === 'function') {
      await Preferences.removeItems({ keys: matching });
      return;
    }
    for (const key of matching) {
      await Preferences.remove({ key });
    }
  },

  /**
   * Return the namespace's setting keys that currently have a stored
   * override, sorted in ascending alphabetical order.
   */
  async keys(namespace) {
    assertNamespace(namespace);
    return listOverriddenKeys(namespace);
  },

  /**
   * Return a plain object mapping every schema key of the namespace to its
   * effective value (defaults merged with overrides).
   */
  async exportNamespace(namespace) {
    assertNamespace(namespace);

    const schema = SCHEMAS[namespace];
    const result = {};
    for (const key of Object.keys(schema)) {
      result[key] = schema[key];
    }

    const { keys } = await Preferences.keys();
    const nsPrefix = `${PREFIX}${namespace}${DELIMITER}`;
    const overrides = keys.filter(
      (raw) => raw.startsWith(nsPrefix) && hasOwn(schema, raw.slice(nsPrefix.length)),
    );

    for (const fullKey of overrides) {
      const settingKey = fullKey.slice(nsPrefix.length);
      const { value } = await Preferences.get({ key: fullKey });
      if (value === null || value === undefined) {
        continue;
      }
      result[settingKey] = JSON.parse(value);
    }

    return result;
  },

  /**
   * Persist every key from `data` that belongs to the namespace schema;
   * unknown keys are silently ignored. Non-object inputs are a no-op.
   */
  async importNamespace(namespace, data) {
    assertNamespace(namespace);

    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return;
    }

    const schema = SCHEMAS[namespace];
    const writes = [];
    for (const [key, value] of Object.entries(data)) {
      if (!hasOwn(schema, key)) {
        continue;
      }
      writes.push(Preferences.set({ key: encodeKey(namespace, key), value: JSON.stringify(value) }));
    }
    await Promise.all(writes);
  },
};

export default settings;