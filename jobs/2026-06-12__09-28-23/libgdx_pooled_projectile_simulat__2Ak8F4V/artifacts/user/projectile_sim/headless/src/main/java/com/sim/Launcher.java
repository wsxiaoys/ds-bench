package com.sim;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

public class Launcher {
    public static void main(String[] args) {
        String scenarioPath = null;
        String outputPath = null;

        for (int i = 0; i < args.length; i++) {
            if ("--scenario".equals(args[i]) && i + 1 < args.length) {
                scenarioPath = args[++i];
            } else if ("--output".equals(args[i]) && i + 1 < args.length) {
                outputPath = args[++i];
            }
        }

        if (scenarioPath == null || outputPath == null) {
            System.err.println("Usage: --scenario <path> --output <path>");
            System.exit(1);
        }

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        SimulationListener listener = new SimulationListener(scenarioPath, outputPath);

        // HeadlessApplication constructor blocks on the calling thread until Gdx.app.exit() is called.
        new HeadlessApplication(listener, config);
    }
}
