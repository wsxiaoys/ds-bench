# Scaffold a Standalone Capacitor Web Plugin Package

## Background
Build a reusable, publishable Capacitor v8 plugin distributed as a standalone npm package named `capacitor-stringkit`. The package must follow the standard Capacitor plugin source layout and, when built, produce distributable bundles (an ESM build plus a CommonJS bundle) together with TypeScript declaration files. This plugin ships a **Web implementation only** — no native Android or iOS folders are required.

## Requirements
- Create the standard Capacitor plugin source layout under `src/`:
  - `src/definitions.ts` — the typed plugin interface `StringKitPlugin`.
  - `src/index.ts` — registers the plugin and re-exports the definitions.
  - `src/web.ts` — a `WebPlugin` subclass that implements the interface for the web.
- Register the plugin under the name `StringKit`.
- The plugin interface must expose exactly these three async methods:
  - `echo(options: { value: string }): Promise<{ value: string }>` — returns the input value unchanged.
  - `reverse(options: { value: string }): Promise<{ value: string }>` — returns the input string reversed.
  - `slugify(options: { value: string }): Promise<{ slug: string }>` — returns a URL-safe slug of the input string.
- Provide a `package.json` with correct entry fields and a working `build` script, plus a bundler configuration (Rollup) that emits the `dist/` output.

## Implementation Hints
- In `src/index.ts`, use `registerPlugin` from `@capacitor/core`, lazy-loading the web implementation, and `export * from './definitions'`.
- The web implementation class must extend `WebPlugin` from `@capacitor/core` and implement `StringKitPlugin`.
- Compile the TypeScript to an ESM build with `tsc`, and bundle a CommonJS distribution with Rollup; wire both into the `build` script so a single `npm run build` produces everything.
- `@capacitor/core` must be treated as an **external / peer dependency** and must NOT be bundled into the output.
- `reverse` must reverse the string (e.g. `"abcde"` becomes `"edcba"`).
- Slug semantics (must match exactly): lowercase the input, replace every run of characters that are NOT lowercase ASCII letters (`a-z`) or digits (`0-9`) with a single hyphen, then strip any leading and trailing hyphens. For example `"  Hello, World! 123 "` becomes `"hello-world-123"`.
- Project path: /home/user/capacitor-stringkit
- Package name (the `name` field in package.json): `capacitor-stringkit`
- Build command: `npm run build`
- The build must produce these outputs:
  - An ESM build directory `dist/esm/` containing `dist/esm/index.js`, `dist/esm/web.js`, and matching declaration files including `dist/esm/index.d.ts`.
  - A CommonJS bundle at `dist/plugin.cjs.js`.
  - The emitted `.d.ts` declarations under `dist/esm/` must declare the `StringKitPlugin` interface with the `echo`, `reverse`, and `slugify` method signatures.
- `package.json` must set: `"module": "dist/esm/index.js"`, `"types": "dist/esm/index.d.ts"`, and `"main": "dist/plugin.cjs.js"`.
- Requiring the built CommonJS bundle `dist/plugin.cjs.js` (Node `require`) must expose the registered `StringKit` object whose `echo`, `reverse`, and `slugify` methods resolve to the described results.
- Importing the ESM web build `dist/esm/web.js` must expose the `StringKitWeb` class implementing the same behavior.

