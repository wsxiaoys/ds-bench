package com.gdx.sim;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

public class Main {
    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: java com.gdx.sim.Main <config-path> <output-path>");
            System.exit(1);
        }

        String configPath = args[0];
        String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0; // run as fast as possible

        // Construct the application
        new HeadlessApplication(new SimulationListener(configPath, outputPath), config);

        // Wait/join the main loop thread so the JVM exits cleanly
        Thread headlessThread = null;
        for (int i = 0; i < 50; i++) {
            for (Thread t : Thread.getAllStackTraces().keySet()) {
                if (t.getName().contains("HeadlessApplication")) {
                    headlessThread = t;
                    break;
                }
            }
            if (headlessThread != null) {
                break;
            }
            try {
                Thread.sleep(10);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        if (headlessThread != null) {
            try {
                headlessThread.join();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        } else {
            System.err.println("Warning: HeadlessApplication thread not found.");
        }
    }
}
