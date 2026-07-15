# Ship a SvelteKit App as a Capacitor-Ready Static Bundle

## Background
A small SvelteKit application in this repository is meant to be wrapped by Capacitor and served from local device storage. Because Capacitor loads the web bundle as static files (no Node server is available at runtime), the app must be prerendered to plain HTML/JS/CSS, and Capacitor's `webDir` must point at the exact directory that SvelteKit emits. The project currently uses `@sveltejs/adapter-auto`, so `npm run build` does **not** produce a self-contained static bundle, and `capacitor.config.ts` points `webDir` at a directory that never gets created. Your job is to reconfigure the project so it compiles to a fully static, single-page-app-capable bundle whose directory matches Capacitor's `webDir`.

## Requirements
- Convert the SvelteKit build to static site generation using `@sveltejs/adapter-static`.
- Enable a single-page-app (SPA) fallback so client-side routes that are not prerendered still resolve when the bundle is loaded from local storage.
- Emit the compiled static site into a directory named `dist` at the project root.
- Update `capacitor.config.ts` so that `webDir` points at that same `dist` directory, resolving the web-assets-directory mismatch so that Capacitor's web-asset detection (the check performed by `npx cap sync`/`npx cap copy`) would find a valid `index.html`.
- Keep the two existing routes working after the static build: the prerendered home page (`/`) and the client-rendered status page (`/status`).

## Implementation Hints
- Install `@sveltejs/adapter-static` as a dev dependency and wire it into `svelte.config.js`.
- For a wrapped-in-a-native-app use case, a fallback page is the supported way to serve routes that are not prerendered; avoid `index.html` as the fallback name so it does not collide with the prerendered home page.
- The prerendered home page must still be emitted as `index.html`; make sure prerendering is not globally disabled in a way that leaves an empty shell.
- Read the existing route files under `src/routes` before changing configuration — do not rewrite the page markup, only make the build produce a static bundle.
- Do NOT add native platforms (`android`/`ios`); no SDK is available. Only the web build and configuration matter here.
- Project path: /home/user/capsvelte
- Build command: `npm run build`
- After building, the bundle directory must be `/home/user/capsvelte/dist` and must contain both `index.html` (prerendered home page) and `200.html` (SPA fallback page).
- `capacitor.config.ts` must set `webDir` to `dist` (a string exactly equal to `dist`).
- The prerendered `/home/user/capsvelte/dist/index.html` must contain the visible home-page text already present in the app's home route.
- The `/status` route is intentionally client-rendered (not prerendered); when the built bundle is served as an SPA it must render its status text in the browser via JavaScript.

