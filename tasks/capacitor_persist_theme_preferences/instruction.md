# Persist User Theme with Capacitor Preferences

## Background
You are building a small Vite + TypeScript web application that will be packaged as a native mobile app via Capacitor v8. To survive native OS storage sweeps, persistent user settings must be stored using the `@capacitor/preferences` plugin instead of the unreliable `window.localStorage`. The Preferences plugin falls back to `localStorage` when the app is served as a Progressive Web App in the browser, so the same code works in the web build that this task will exercise.

A minimal Vite TypeScript project has already been scaffolded for you at `/home/user/myapp`. Your job is to integrate Capacitor v8, install the Preferences plugin, and implement a dark/light theme toggle whose value persists across reloads via Capacitor's Preferences API.

## Requirements
- Integrate Capacitor v8 into the existing Vite project. The Capacitor app must be configured with:
    - App name: `Theme Demo`
    - Application/package id: `com.example.themedemo`
    - Web assets directory aligned with Vite's build output (`dist`).
- Install and use the `@capacitor/preferences` plugin (version compatible with Capacitor v8) for persistence.
- Implement a UI in `index.html` that includes a button users can click to toggle between `light` and `dark` themes. The button must have the HTML id `theme-toggle`.
- Persist the currently selected theme under the Preferences key `user_theme` (value `"light"` or `"dark"`).
- On every page load, read the saved theme from Capacitor Preferences and apply it before the user interacts. If no value has been stored yet, default to `light`.
- Toggling the button must update the visible theme, persist the new value through the Preferences API, and continue to work correctly across full page reloads.
- The production build must succeed and `npx cap sync` must run successfully against the produced web build.

## Deliverable
- Project path: `/home/user/myapp`
- Port: `4173`