# Implement a Custom Local Capacitor Android Plugin

## Background
You are working on a Capacitor v8 hybrid mobile application located at `/home/user/myapp`. The project already has the `android` platform scaffolded at `/home/user/myapp/android` and a minimal web frontend in `/home/user/myapp/dist`. The web team needs a thin native bridge to expose deterministic mocked sensor readings so the UI can be developed before real hardware integration is finished.

Your job is to design and implement a custom local Capacitor plugin (Java, inside the existing Android project) that exposes a small sensor API to JavaScript, register it in `MainActivity`, and wire up the JavaScript-side bindings so that the project compiles cleanly through Gradle.

## Requirements
- Implement a custom local Android Capacitor plugin written in Java inside the existing Android project (do **not** create a separate Capacitor plugin npm package).
- The plugin must be exposed to JavaScript under the exact name `DeviceSensor`.
- The plugin must declare two methods that are reachable from JavaScript:
  - `getReading(options)` — accepts a `sensor` string and resolves with a JSON object describing the reading.
  - `isAvailable(options)` — accepts a `sensor` string and resolves with `{ available: boolean }`.
- The plugin must support exactly these sensor identifiers and return the following deterministic mocked values from `getReading`:
  - `temperature` → `{ "sensor": "temperature", "value": 22.5, "unit": "C" }`
  - `humidity` → `{ "sensor": "humidity", "value": 65.0, "unit": "%" }`
  - `battery` → `{ "sensor": "battery", "value": 87.0, "unit": "%" }`
- For any other sensor name, `getReading` must reject the call with a non-empty error message, and `isAvailable` must resolve with `{ available: false }`. For the three supported sensors, `isAvailable` must resolve with `{ available: true }`.
- Register the plugin in the existing `MainActivity` so it is loaded by the Capacitor bridge at startup.
- Provide a TypeScript binding file at `/home/user/myapp/src/device-sensor.ts` that uses `registerPlugin` from `@capacitor/core` to expose the plugin and exports the plugin object as the default export.
- The complete Android project must compile successfully with the Gradle wrapper.

## Implementation Hints
- Refer to the official Capacitor v8 "Custom Native Android Code" guide. The plugin class must extend `com.getcapacitor.Plugin` and be annotated with `@CapacitorPlugin(name = "DeviceSensor")`. Each exposed method must be annotated with `@PluginMethod`.
- Use `PluginCall.getString`, `JSObject`, `call.resolve`, and `call.reject` for argument parsing and result handling.
- The plugin's Java package must match the application package (`com.example.myapp`); place the source under `android/app/src/main/java/com/example/myapp/` so the existing Gradle source set picks it up.
- Register the plugin with `registerPlugin(MyPlugin.class)` inside `MainActivity.onCreate` before the call to `super.onCreate(savedInstanceState)`.
- On the JavaScript side, the first argument to `registerPlugin` must match the `name` attribute of the `@CapacitorPlugin` annotation exactly.
- The web frontend already has `@capacitor/core` installed as an npm dependency; you do not need to install additional packages.
- The Android SDK, JDK 17, and the Gradle wrapper are pre-installed and pre-warmed inside the project; running `./gradlew` from `/home/user/myapp/android` will compile the project. Use the `--offline` flag whenever possible to avoid re-downloading dependencies.

