# Capacitor Keyboard: Config Options + Show/Hide Layout Listeners

## Background
You are working on a Capacitor v8 chat-style web app that has a sticky bottom "composer" bar (a text input with a send button). On mobile, the software keyboard covers this bar, so the app needs to lift the composer above the keyboard whenever it appears and drop it back when it disappears. Capacitor's `@capacitor/keyboard` plugin controls keyboard behavior and emits show/hide events.

A Vite + TypeScript project is already scaffolded and its dependencies (including `@capacitor/keyboard`, `@capacitor/core`, and `@capacitor/cli`) are already installed. Your job is to configure the Keyboard plugin and wire up the layout logic.

## Requirements
- Configure the `@capacitor/keyboard` plugin inside `capacitor.config.ts` with these exact behaviors:
  - The app content resizes by shrinking the `body` element when the keyboard appears.
  - The keyboard uses a forced dark appearance.
  - The Android full-screen resize workaround is enabled.
- In the web app code, register handlers for the keyboard show and hide events so the composer bar is offset by the keyboard height while the keyboard is visible.
- The offset must be driven by a CSS custom property so the existing stylesheet can move the composer without further changes.

## Implementation Hints
- Project path: /home/user/app
- Configure the plugin under the `plugins.Keyboard` key of the `CapacitorConfig` object in `capacitor.config.ts`. You may use the enum members exported by `@capacitor/keyboard` or their raw string values; the effective values must be: resize mode = body, style = dark, and the Android full-screen resize workaround = enabled.
- The app must work when running in a plain browser/web context. In that context the keyboard events are delivered as `window` events named `keyboardWillShow`, `keyboardWillHide`, `keyboardDidShow`, and `keyboardDidHide`. The show events carry the keyboard height as a numeric `keyboardHeight` property directly on the event object (this mirrors the `cordova-plugin-ionic-keyboard` compatibility layer). Attach your handlers so they react to at least the `keyboardWillShow` and `keyboardWillHide` events.
- Maintain a CSS custom property named `--keyboard-offset` on the document root element (`document.documentElement`). When a keyboard show event fires, set it to the reported keyboard height in pixels (e.g. `"300px"`) and add the class `keyboard-open` to `document.body`. When a keyboard hide event fires, set it back to `"0px"` and remove the `keyboard-open` class.
- Do not hardcode a fixed height; always read the height from the event so different keyboards produce different offsets.
- The composer bar element (already present as `#composer` in `index.html`) and the stylesheet that consumes `--keyboard-offset` are already in place; you only need to update `capacitor.config.ts` and the app entry code so the variable and class are managed correctly.
- Verification builds the app with `npm run build` and loads it in a headless browser, then dispatches the `window` keyboard events described above. No native device, emulator, or Android/iOS SDK is used.

