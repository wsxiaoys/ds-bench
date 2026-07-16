# Typed, Versioned JSON Store on top of Capacitor Preferences

## Background
`@capacitor/preferences` is Capacitor's lightweight key/value persistence plugin. It only stores **string** values, so structured application data must be serialized to JSON before being persisted and parsed back on read. In a long-lived app the *shape* of that stored data changes over time, so a robust storage layer must embed a schema version alongside the data and be able to upgrade older payloads to the current shape when they are read back.

Your job is to build a small, reusable **versioned JSON store** module on top of `@capacitor/preferences` (its web implementation, which is backed by `localStorage`).

## Requirements
- Implement the module in `src/store.ts` and export a named factory function `createVersionedStore`.
- `createVersionedStore(config)` accepts a config object with:
  - `key: string` — the Preferences key under which data is stored.
  - `version: number` — the current schema version (a positive integer).
  - `migrations?: Record<number, (data: any) => any>` — an optional map whose entry keyed by integer `n` upgrades a data payload from version `n` to version `n + 1`.
- The factory returns a store object exposing exactly these async methods:
  - `get(): Promise<any | null>`
  - `set(value: any): Promise<void>`
  - `remove(): Promise<void>`
- All persistence MUST go through `@capacitor/preferences` (`Preferences.set` / `Preferences.get` / `Preferences.remove`). Do not read or write `localStorage` directly.

## Implementation Hints
- Use `JSON.stringify` / `JSON.parse` to serialize an *envelope* around the user data so the version travels with the payload.
- Think of migrations as a chain: to upgrade a payload from version `a` to version `b`, apply each migration function for the source versions `a, a+1, ..., b-1` in ascending order, feeding the output of one into the next.
- Make the upgrade *durable*: once a payload has been migrated on read, the newly upgraded envelope should be persisted back so the migration only happens once.
- Make the upgrade *atomic*: if any migration function throws, nothing should be persisted and the previously stored value must be left exactly as it was.

### Hard requirements (must hold exactly)
- Project path: `/home/user/project`.
- The value written to Preferences for a store MUST be a JSON string of an envelope object with exactly two top-level keys: `version` (number) and `data` (the user value). Example serialized form: `{"version":3,"data":{...}}`.
- `set(value)` persists the envelope stamped with the store's **current** `version`.
- `get()`:
  - returns `null` when the key does not exist in Preferences.
  - when the stored envelope `version` equals the store's current `version`, returns the stored `data` unchanged.
  - when the stored envelope `version` is **less than** the current `version`, runs the migration chain from the stored version up to the current version, persists the upgraded envelope back (stamped with the current `version`), and returns the upgraded `data`.
  - when the stored envelope `version` is **greater than** the current `version`, rejects (throws) and does not modify the stored value.
  - if a migration function throws while upgrading, `get()` rejects and the stored value in Preferences remains exactly the original (pre-migration) envelope.
- `remove()` deletes the key from Preferences so a subsequent `get()` returns `null`.
- The module must be importable in a jsdom-based test environment via `import { createVersionedStore } from './store'` (or the compiled equivalent). Keep it dependency-light: rely only on `@capacitor/core` / `@capacitor/preferences` already installed in the project.

