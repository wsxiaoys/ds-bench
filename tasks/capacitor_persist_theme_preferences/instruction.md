# Persist User Theme with Capacitor Preferences

## Background
You are building a small Vite + TypeScript web application that will be packaged as a native mobile app via Capacitor v8. To survive native OS storage sweeps, persistent user settings must be stored using the `@capacitor/preferences` plugin instead of the unreliable `window.localStorage`. The Preferences plugin falls back to `localStorage` when the app is served as a Progressive Web App in the browser, so the same code works in the web build that this task will exercise.

A minimal Vite TypeScript project has already been scaffolded for you at `/home/user/myapp`. Your job is to integrate Capacitor v8, install the Preferences plugin, and implement a dark/light theme toggle whose value persists across reloads via Capacitor's Preferences API.

## Requirements
- Integrate Capacitor v8 into the existing Vite project. The Capacitor app must be configured with:
    - App name: `Theme Demo`
    - Application/package id: `com.example.themedemo`
    - Web assets directory aligned with Vite's build output.
- Install and use the `@capacitor/preferences` plugin (version compatible with Capacitor v8) for persistence. The persisted theme must be stored under the Preferences key `user_theme` with value `"light"` or `"dark"`.
- Implement a UI in `index.html` that includes a single visible toggle button with the HTML id `theme-toggle` that switches between `light` and `dark` themes.
- The active theme must be reflected on the `<body>` element by toggling a single CSS class named `dark` (present when dark mode is on, absent when light mode is on).
- On every page load, read the saved theme from Capacitor Preferences and apply it before the user interacts. If no value has been stored yet, default to `light`.
- Toggling the button must update the visible theme, persist the new value through the Preferences API, and continue to work correctly across full page reloads.
- The production build must succeed and `npx cap sync` must run successfully against the produced web build.

## Deliverable
- Project path: `/home/user/myapp`
- Start command: `npm run preview -- --host 0.0.0.0 --port 4173`
- Port: `4173`
