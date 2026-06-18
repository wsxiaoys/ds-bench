package com.gdxecs;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

public class Main {

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: gdx-ecs <scenario_path>");
            System.exit(1);
        }

        String scenarioPath = args[0];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60;

        SimulationListener listener = new SimulationListener(scenarioPath);
        HeadlessApplication app = new HeadlessApplication(listener, config);

        // The headless application runs on its own thread. We need to wait for it to finish.
        // The thread is typically named "HeadlessApplication" -- find it and join it.
        Thread headlessThread = findHeadlessThread();
        if (headlessThread != null) {
            try {
                headlessThread.join();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private static Thread findHeadlessThread() {
        // The headless backend creates a thread named "HeadlessApplication"
        // We poll until it appears, then return it.
        // Give it a reasonable timeout.
        long deadline = System.currentTimeMillis() + 30_000;
        while (System.currentTimeMillis() < deadline) {
            for (Thread t : Thread.getAllStackTraces().keySet()) {
                if (t.getName().equals("HeadlessApplication")) {
                    return t;
                }
            }
            try {
                Thread.sleep(10);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return null;
            }
        }
        return null;
    }
}
