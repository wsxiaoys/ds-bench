import UIKit
import Capacitor

class MyViewController: CAPBridgeViewController {
    // Add Capacitor-specific overrides here, such as capacitorDidLoad() for
    // registering custom local plugins.

    override func capacitorDidLoad() {
        // Register custom local plugin instances with the Capacitor bridge.
        bridge?.registerPluginInstance(EchoPlugin())

        super.capacitorDidLoad()
    }
}
