package com.example.ecs;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Entry point: boots the Ashley-powered simulation under HeadlessApplication,
 * then waits for the headless main-loop thread to finish before returning so
 * that stdout output is complete and reproducible.
 */
public class Main {

    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("Usage: Main <scenario-file>");
            System.exit(2);
        }
        String scenarioPath = args[0];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60;

        SimulationListener listener = new SimulationListener(scenarioPath);
        // Constructing HeadlessApplication starts the main-loop thread immediately.
        new HeadlessApplication(listener, config);

        // The headless main loop runs on its own thread named "HeadlessApplication".
        // Wait for it to appear, then join it so the JVM does not exit early.
        Thread headlessThread = findHeadlessThread();
        if (headlessThread != null) {
            headlessThread.join();
        }
    }

    /**
     * Locate the headless application's main-loop thread by name. Polls briefly
     * in case the thread has not yet been registered when we look.
     */
    private static Thread findHeadlessThread() throws InterruptedException {
        long deadline = System.currentTimeMillis() + 30_000L;
        while (System.currentTimeMillis() < deadline) {
            for (Thread t : Thread.getAllStackTraces().keySet()) {
                if ("HeadlessApplication".equals(t.getName())) {
                    return t;
                }
            }
            Thread.sleep(5);
        }
        return null;
    }
}