# Implement a Custom Local iOS Plugin for a Capacitor v8 App

## Background
A Capacitor v8 hybrid app is pre-scaffolded at `/home/user/myapp`. The native iOS platform has already been added with `npx cap add ios` and committed to source control, including a custom `MyViewController.swift` subclass wired up in `Main.storyboard`. The product team wants to call a native Swift method from JavaScript, but no plugin exists yet for this echo capability. Your job is to build a Capacitor v8 local plugin in Swift, register it with the bridge in the existing view controller, and expose it to the web layer through a TypeScript wrapper.

Because this benchmark runs on Linux, you will not be able to invoke `xcodebuild`. Instead, the verifier checks the Swift source files, the Xcode project membership in `project.pbxproj`, the JavaScript wrapper, and that `npx cap sync ios` still succeeds.

## Requirements
- Implement a Swift Capacitor plugin called `EchoPlugin` at `/home/user/myapp/ios/App/App/EchoPlugin.swift` that conforms to both `CAPPlugin` and `CAPBridgedPlugin`.
  - It must import `Capacitor` at the top of the file.
  - It must be exposed to the Objective-C runtime with the class name `EchoPlugin` using `@objc(EchoPlugin)`.
  - It must declare `public let identifier = "EchoPlugin"` and `public let jsName = "Echo"`.
  - It must declare a `pluginMethods: [CAPPluginMethod]` array containing a `CAPPluginMethod(name: "echo", returnType: CAPPluginReturnPromise)` entry.
  - It must implement `@objc func echo(_ call: CAPPluginCall)` that resolves the call with a dictionary echoing the `value` argument back under the key `"value"` (default to an empty string when missing).
- Register the plugin instance with the Capacitor bridge by overriding `capacitorDidLoad()` in the existing `MyViewController.swift` and calling `bridge?.registerPluginInstance(EchoPlugin())`.
- Add `EchoPlugin.swift` to the Xcode build target so it ends up in both `PBXFileReference` and `PBXSourcesBuildPhase` sections of `ios/App/App.xcodeproj/project.pbxproj`.
- Create a TypeScript wrapper at `/home/user/myapp/src/echo.ts` that imports `registerPlugin` from `@capacitor/core` and registers the plugin under the exact name `"Echo"`.
- After your changes, `npx cap sync ios` must still complete successfully from the project root.

## Implementation Hints
- Read the official Capacitor v8 "Custom Native iOS Code" guide. The modern v8 protocol is `CAPBridgedPlugin` (with `identifier`, `jsName`, and `pluginMethods` properties), used together with `CAPPlugin` as the base class.
- The `@objc(EchoPlugin)` decorator is required for the Capacitor runtime to discover the plugin by name.
- `bridge?.registerPluginInstance(...)` is called from `capacitorDidLoad()` inside the view controller that subclasses `CAPBridgeViewController` — that file already exists in the project.
- Because Xcode is not available, you must edit `project.pbxproj` directly. Mirror the patterns used for existing Swift files (such as `MyViewController.swift`): add a `PBXFileReference`, a `PBXBuildFile`, an entry in the `App` group `PBXGroup` children, and an entry in the `Sources` `PBXSourcesBuildPhase`.
- `pod` (CocoaPods) is not available in the Linux container; `npx cap sync ios` will skip the pod install step automatically and still exit 0.

