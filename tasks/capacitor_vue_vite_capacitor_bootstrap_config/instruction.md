# Bootstrap Capacitor into a Vue 3 + Vite Web Project

## Background
You are given an existing Vue 3 + Vite web application. Your job is to bootstrap [Capacitor](https://capacitorjs.com/) v8 into this project as a **web-only** setup: install the Capacitor runtime and CLI, initialize the Capacitor configuration non-interactively, align the Vite build output directory with Capacitor's `webDir`, and produce a working web build. This is a CLI/web bootstrap task only — you must **not** add any native mobile platforms.

## Requirements
- Add `@capacitor/core` as a runtime dependency and `@capacitor/cli` as a dev dependency to the project.
- Initialize Capacitor **non-interactively** (no interactive prompts) so that a `capacitor.config.ts` file is generated with:
  - app name: `Vue Capacitor Demo`
  - app id (package id): `com.zealt.vuedemo`
  - web directory: `www`
- Align the Vite bundler so that its production build output goes to the same directory declared as Capacitor's `webDir` (`www`).
- Build the web assets so the configured `webDir` contains a valid `index.html` plus the bundled app.
- Do **not** add native platforms (do not run `cap add android`/`cap add ios`, and do not install `@capacitor/android` or `@capacitor/ios`).

## Implementation Hints
- Capacitor's CLI can initialize configuration without prompts when the app name, app id, and web directory are all provided on the command line.
- The `webDir` in `capacitor.config.ts` must point at the directory your bundler actually writes to; Vite's default output directory is not `www`, so you must reconcile them.
- Make sure the web build is run after configuring the output directory, so the artifacts actually exist.
- The dev server / app is a standard Vite + Vue single-page app; the built `index.html` loads the bundled JavaScript which mounts the Vue app.
- Project path: /home/user/vue-capacitor-app
- Build command: `npm run build`
- After a successful build, `/home/user/vue-capacitor-app/www/index.html` must exist and load the bundled app.
- `capacitor.config.ts` must export (as its default export) a config object whose `appId` is `com.zealt.vuedemo`, `appName` is `Vue Capacitor Demo`, and `webDir` is `www`.
- When the built `www` directory is served over HTTP and opened in a browser, the page must render the app heading text `Vue Capacitor Demo`.

