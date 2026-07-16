# Align Angular Build Output With Capacitor's webDir

## Background
You have an existing Angular workspace that has been wrapped with Capacitor v8 so it can eventually run as a native app. The project builds fine as a website, but the Capacitor tooling can no longer locate the compiled web assets. When you try to copy the web assets into Capacitor you get the classic friction error:

```
[error] Could not find the web assets directory: ...
Please create it and make sure it has an index.html file.
```

The root cause is a mismatch between where Angular's `@angular/build:application` builder actually emits the compiled site and the `webDir` that Capacitor is configured to read from. Modern Angular does not emit `index.html` directly into the configured output path; the application builder writes the browser bundle into a nested sub-directory of that output path. On top of that, the output path declared in `angular.json` and the `webDir` declared in the Capacitor config currently point at two different folder names.

## Requirements
- Diagnose and fix the configuration so that Capacitor's web asset detection succeeds.
- Reconcile the Angular build `outputPath` (in `angular.json`) and Capacitor's `webDir` (in `capacitor.config.ts`) so they refer to the same real location.
- Account for the browser sub-directory that Angular's application builder creates, so that the folder Capacitor reads from actually contains the built `index.html`.
- Do NOT hand-craft, hand-copy, or commit a static `index.html`; the assets Capacitor reads must be the genuine output produced by building the Angular app.
- Do NOT add native platforms (no `ios` / `android`); this must be solved with configuration only.

## Implementation Hints
- Inspect `angular.json` (the `build` target `outputPath`) and `capacitor.config.ts` (`webDir`) and make them consistent. You may adjust either or both files; there is more than one valid way to make them line up, but they MUST agree on a single folder that ends up containing `index.html` after a build.
- Remember the Angular application builder's default browser sub-folder behavior when deciding what path `webDir` should point to; the `outputPath` option can be a plain string base or an object with `base`/`browser` fields.
- The web build must keep working. After your fix, running the project's build script must succeed and produce the compiled site, and `webDir` must resolve to the directory inside the build output that holds `index.html`.
- Project path: /home/user/mobileapp
- Build command: `npm run build` (Angular CLI, runs fully offline; no dev server or native platform is required).
- Asset-detection command: `npx cap copy` must complete WITHOUT printing `Could not find the web assets directory` or `must contain an index.html file`. Because no native platform is added, this only exercises Capacitor's web asset detection against `webDir`.
- `webDir` must point at a directory located inside the Angular build output directory (`dist/`), i.e. the real compiled output — not a separate hand-populated folder.

