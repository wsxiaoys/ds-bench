package com.mygame;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

public class Main {
    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: Main <scenario_file_path>");
            System.exit(1);
        }
        String scenarioPath = args[0];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60;

        SimulationListener listener = new SimulationListener(scenarioPath);
        new HeadlessApplication(listener, config);

        // Find the HeadlessApplication thread and join it
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
                System.err.println("Main thread interrupted while waiting for simulation to finish.");
                Thread.currentThread().interrupt();
            }
        }
    }
}
