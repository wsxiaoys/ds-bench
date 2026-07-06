package com.example.myapp;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceSensor")
public class DeviceSensorPlugin extends Plugin {

    @PluginMethod
    public void getReading(PluginCall call) {
        String sensor = call.getString("sensor");
        if (sensor == null) {
            call.reject("Sensor parameter is required");
            return;
        }

        JSObject ret = new JSObject();
        switch (sensor) {
            case "temperature":
                ret.put("sensor", "temperature");
                ret.put("value", 22.5);
                ret.put("unit", "C");
                call.resolve(ret);
                break;
            case "humidity":
                ret.put("sensor", "humidity");
                ret.put("value", 65.0);
                ret.put("unit", "%");
                call.resolve(ret);
                break;
            case "battery":
                ret.put("sensor", "battery");
                ret.put("value", 87.0);
                ret.put("unit", "%");
                call.resolve(ret);
                break;
            default:
                call.reject("Sensor not supported: " + sensor);
                break;
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        String sensor = call.getString("sensor");
        JSObject ret = new JSObject();
        if (sensor != null && (sensor.equals("temperature") || sensor.equals("humidity") || sensor.equals("battery"))) {
            ret.put("available", true);
        } else {
            ret.put("available", false);
        }
        call.resolve(ret);
    }
}
