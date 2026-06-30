# Implement a Custom Local iOS Plugin for a Capacitor v8 App

## Background
A Capacitor v8 hybrid app is pre-scaffolded at `/home/user/myapp`. The native iOS platform has already been added with `npx cap add ios` and committed to source control, including a custom `MyViewController.swift` subclass wired up in `Main.storyboard`. The product team wants to call a native Swift method from JavaScript, but no plugin exists yet for this echo capability. Your job is to build a Capacitor v8 local plugin in Swift, register it with the bridge in the existing view controller, and expose it to the web layer through a TypeScript wrapper.

Because this benchmark runs on Linux, you will not be able to invoke `xcodebuild`. Instead, the verifier checks the Swift source files, the Xcode project membership in `project.pbxproj`, the JavaScript wrapper, and that `npx cap sync ios` still succeeds.

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