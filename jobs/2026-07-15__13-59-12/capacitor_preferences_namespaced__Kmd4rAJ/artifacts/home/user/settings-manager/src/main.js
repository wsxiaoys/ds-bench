import { Preferences } from '@capacitor/preferences';

// ---------------------------------------------------------------------------
// Namespaced settings manager built on top of @capacitor/preferences.
// ---------------------------------------------------------------------------

// Delimiter used to encode the namespace into each Preferences storage key.
// Including the delimiter in the prefix used for filtering makes the matching
// delimiter-aware: the namespace `app` (prefix `app::`) will never match keys
// belonging to the namespace `appearance` (whose keys look like `appearance::...`).
const DELIMITER = '::';

// Fixed namespace schemas. Each entry maps a setting key to its typed default
// value. The JavaScript type of the default is preserved across persistence by
// serializing values with JSON on the way in and parsing them on the way out.
const SCHEMAS = {
  app: {
    theme: 'light', // string
    fontSize: 14, // number
    notifications: true, // boolean
  },
  appearance: {
    theme: 'system', // string
    accent: 'blue', // string
  },
  editor: {
    tabSize: 4, // number
    wordWrap: false, // boolean
  },
};

/**
 * Build the Preferences storage key for a (namespace, settingKey) pair.
 */
const storageKey = (namespace, key) => `${namespace}${DELIMITER}${key}`;

/**
 * The prefix every stored key for a given namespace shares. Used for
 * delimiter-aware filtering of the Preferences `keys()` listing.
 */
const namespacePrefix = (namespace) => `${namespace}${DELIMITER}`;

/**
 * Reject the promise if `namespace` is not a known namespace.
 */
function assertNamespace(namespace) {
  if (!Object.prototype.hasOwnProperty.call(SCHEMAS, namespace)) {
    throw new Error(`Unknown settings namespace: ${String(namespace)}`);
  }
}

/**
 * Reject the promise if `key` is not a setting declared in the namespace schema.
 */
function assertKey(namespace, key) {
  assertNamespace(namespace);
  if (!Object.prototype.hasOwnProperty.call(SCHEMAS[namespace], key)) {
    throw new Error(
      `Unknown settings key: ${String(key)} in namespace ${String(namespace)}`,
    );
  }
}

const settings = {
  /**
   * Resolve to the effective value for `key` in `namespace`: the stored
   * override when present, otherwise the schema default. The original
   * JavaScript type of the value is preserved.
   *
   * Rejects when the namespace or key is not part of a schema.
   */
  async get(namespace, key) {
    assertKey(namespace, key);
    const { value } = await Preferences.get({ key: storageKey(namespace, key) });
    if (value === null || value === undefined) {
      return SCHEMAS[namespace][key];
    }
    return JSON.parse(value);
  },

  /**
   * Persist `value` for `key` in `namespace` through Preferences.
   *
   * Rejects when the namespace or key is not part of a schema.
   */
  async set(namespace, key, value) {
    assertKey(namespace, key);
    await Preferences.set({
      key: storageKey(namespace, key),
      value: JSON.stringify(value),
    });
  },

  /**
   * Remove every stored override that belongs only to `namespace`. After a
   * reset those settings fall back to their defaults and every other namespace
   * is left untouched.
   */
  async reset(namespace) {
    assertNamespace(namespace);
    const prefix = namespacePrefix(namespace);
    const { keys } = await Preferences.keys();
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        await Preferences.remove({ key });
      }
    }
  },

  /**
   * Resolve to an array of the setting keys in `namespace` that currently have
   * a stored override, sorted in ascending alphabetical order.
   */
  async keys(namespace) {
    assertNamespace(namespace);
    const prefix = namespacePrefix(namespace);
    const { keys } = await Preferences.keys();
    const own = [];
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        own.push(key.slice(prefix.length));
      }
    }
    own.sort();
    return own;
  },

  /**
   * Resolve to a plain object mapping every schema key of `namespace` to its
   * effective value (defaults merged with stored overrides).
   */
  async exportNamespace(namespace) {
    assertNamespace(namespace);
    const result = {};
    for (const key of Object.keys(SCHEMAS[namespace])) {
      result[key] = await settings.get(namespace, key);
    }
    return result;
  },

  /**
   * Persist each known setting key found in `data` into `namespace`. Keys that
   * are not present in the namespace schema are ignored.
   */
  async importNamespace(namespace, data) {
    assertNamespace(namespace);
    if (!data || typeof data !== 'object') {
      return;
    }
    const schema = SCHEMAS[namespace];
    for (const key of Object.keys(data)) {
      if (Object.prototype.hasOwnProperty.call(schema, key)) {
        await settings.set(namespace, key, data[key]);
      }
    }
  },
};

// Expose the async settings API on the page.
window.settings = settings;

console.log('Namespaced settings manager ready. window.settings is available.');