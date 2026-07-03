import Foundation
import Capacitor

/**
 * A custom local Capacitor plugin that echoes back the `value` argument
 * provided by the JavaScript layer.
 *
 * Conforms to `CAPPlugin` (the base class) and `CAPBridgedPlugin` (the modern
 * Capacitor v8 plugin protocol that exposes `identifier`, `jsName`, and
 * `pluginMethods` to the runtime).
 */
@objc(EchoPlugin)
public class EchoPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EchoPlugin"
    public let jsName = "Echo"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "echo", returnType: CAPPluginReturnPromise)
    ]

    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve([
            "value": value
        ])
    }
}