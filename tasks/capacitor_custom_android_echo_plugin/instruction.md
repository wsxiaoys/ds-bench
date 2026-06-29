# Implement a Custom Local Capacitor Android `Echo` Plugin

## Background
You are working on a Capacitor v8 hybrid mobile application located at `/home/user/myapp`. The project already has the `android` platform scaffolded at `/home/user/myapp/android` and a minimal web frontend in `/home/user/myapp/dist`. The team needs a tiny native bridge that simply round-trips a string from JavaScript so they can sanity-check the JS ↔ Java communication path end-to-end before wiring up real features.

Your job is to write a custom local Capacitor plugin (Java, inside the existing Android project) that exposes a single `echo` method, register it in `MainActivity`, and add a TypeScript wrapper so the project compiles cleanly through Gradle.

## Requirements
- Implement a custom local Android Capacitor plugin written in Java inside the existing Android project (do **not** create a separate Capacitor plugin npm package).
- The plugin must be exposed to JavaScript under the exact name `Echo`.
- The plugin must declare a single method that is reachable from JavaScript:
  - `echo(options)` — accepts a `value` string and resolves with `{ value: <same string> }` (i.e. the input value is round-tripped unchanged).
- Register the plugin in the existing `MainActivity` so that it is loaded by the Capacitor bridge at startup.
- Provide a TypeScript binding file at `/home/user/myapp/src/echo.ts` that uses `registerPlugin` from `@capacitor/core` to expose the plugin and exports the plugin object as the default export.
- The complete Android project must compile successfully with the Gradle wrapper.

## Implementation Hints
- Refer to the official Capacitor v8 "Custom Native Android Code" guide. The plugin class must extend `com.getcapacitor.Plugin` and be annotated with `@CapacitorPlugin(name = "Echo")`. The exposed method must be annotated with `@PluginMethod`.
- Use `PluginCall.getString("value")`, `JSObject`, and `call.resolve(...)` for argument parsing and result handling.
- The plugin's Java package must match the application package (`com.example.myapp`); place the source under `android/app/src/main/java/com/example/myapp/` so the existing Gradle source set picks it up.
- Register the plugin with `registerPlugin(EchoPlugin.class)` inside `MainActivity.onCreate(Bundle savedInstanceState)` before the call to `super.onCreate(savedInstanceState)`.
- On the JavaScript side, the first argument to `registerPlugin` must match the `name` attribute of the `@CapacitorPlugin` annotation exactly (`"Echo"`).
- The web frontend already has `@capacitor/core` installed as an npm dependency; you do not need to install additional packages.
- The Android SDK, JDK, and the Gradle wrapper are pre-installed and pre-warmed inside the project; running `./gradlew` from `/home/user/myapp/android` will compile the project. Use the `--offline` flag whenever possible to avoid re-downloading dependencies.

