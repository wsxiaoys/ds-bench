package com.example.myapp;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * A simple stateful counter plugin that exposes an integer counter
 * held as instance state on the plugin. The counter can be incremented
 * or reset, and any change is announced to JavaScript listeners via
 * a "change" event.
 */
@CapacitorPlugin(name = "Counter")
public class CounterPlugin extends Plugin {

    private int counter = 0;

    @PluginMethod
    public void increment(PluginCall call) {
        counter += 1;
        notifyListeners("change", makeValuePayload(counter));
        call.resolve(makeValuePayload(counter));
    }

    @PluginMethod
    public void reset(PluginCall call) {
        counter = 0;
        notifyListeners("change", makeValuePayload(counter));
        call.resolve(makeValuePayload(counter));
    }

    @PluginMethod
    public void getValue(PluginCall call) {
        call.resolve(makeValuePayload(counter));
    }

    private JSObject makeValuePayload(int value) {
        JSObject data = new JSObject();
        data.put("value", value);
        return data;
    }
}
