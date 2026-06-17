package com.example.headless;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

public class HeadlessLauncher {
    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Please provide a script path.");
            System.exit(1);
        }
        
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;
        
        GeometryApp app = new GeometryApp(args[0]);
        new HeadlessApplication(app, config);
    }
}
