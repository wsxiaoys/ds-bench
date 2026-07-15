import { Preferences } from '@capacitor/preferences';

const SCHEMAS = {
  app: {
    theme: 'light',
    fontSize: 14,
    notifications: true
  },
  appearance: {
    theme: 'system',
    accent: 'blue'
  },
  editor: {
    tabSize: 4,
    wordWrap: false
  }
};

const DELIMITER = ':';

function validateNamespace(namespace) {
  if (!SCHEMAS.hasOwnProperty(namespace)) {
    throw new Error(`Invalid namespace: "${namespace}"`);
  }
}

function validateKey(namespace, key) {
  validateNamespace(namespace);
  if (!SCHEMAS[namespace].hasOwnProperty(key)) {
    throw new Error(`Invalid key "${key}" for namespace "${namespace}"`);
  }
}

const settings = {
  async get(namespace, key) {
    validateKey(namespace, key);
    const prefKey = `${namespace}${DELIMITER}${key}`;
    const { value } = await Preferences.get({ key: prefKey });
    if (value === null || value === undefined) {
      return SCHEMAS[namespace][key];
    }
    try {
      return JSON.parse(value);
    } catch (e) {
      return SCHEMAS[namespace][key];
    }
  },

  async set(namespace, key, value) {
    validateKey(namespace, key);
    const prefKey = `${namespace}${DELIMITER}${key}`;
    await Preferences.set({
      key: prefKey,
      value: JSON.stringify(value)
    });
  },

  async reset(namespace) {
    validateNamespace(namespace);
    const { keys } = await Preferences.keys();
    const prefix = `${namespace}${DELIMITER}`;
    const schemaKeys = SCHEMAS[namespace];
    const keysToRemove = keys.filter(k => {
      if (!k.startsWith(prefix)) {
        return false;
      }
      const settingKey = k.slice(prefix.length);
      return schemaKeys.hasOwnProperty(settingKey);
    });
    await Promise.all(keysToRemove.map(key => Preferences.remove({ key })));
  },

  async keys(namespace) {
    validateNamespace(namespace);
    const { keys } = await Preferences.keys();
    const prefix = `${namespace}${DELIMITER}`;
    const schemaKeys = SCHEMAS[namespace];
    const overriddenKeys = [];
    for (const k of keys) {
      if (k.startsWith(prefix)) {
        const settingKey = k.slice(prefix.length);
        if (schemaKeys.hasOwnProperty(settingKey)) {
          overriddenKeys.push(settingKey);
        }
      }
    }
    return overriddenKeys.sort();
  },

  async exportNamespace(namespace) {
    validateNamespace(namespace);
    const schemaKeys = Object.keys(SCHEMAS[namespace]);
    const result = {};
    for (const key of schemaKeys) {
      result[key] = await this.get(namespace, key);
    }
    return result;
  },

  async importNamespace(namespace, data) {
    validateNamespace(namespace);
    if (!data || typeof data !== 'object') {
      return;
    }
    const schemaKeys = SCHEMAS[namespace];
    for (const key of Object.keys(data)) {
      if (schemaKeys.hasOwnProperty(key)) {
        await this.set(namespace, key, data[key]);
      }
    }
  }
};

window.settings = settings;
