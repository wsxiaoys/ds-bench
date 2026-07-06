package com.example.myapp;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(DeviceSensorPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
