package com.example.gdxecs;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.io.File;

/**
 * Entry-point. Boots a {@link HeadlessApplication}, waits for the headless
 * main-loop thread to finish, then exits.
 *
 * <p>Usage:
 * <pre>
 *   java -jar gdx-ecs.jar &lt;scenario-file&gt;
 * </pre>
 */
public class Main {

    public static void main(String[] args) throws InterruptedException {
        if (args.length < 1) {
            System.err.println("Usage: gdx-ecs <scenario-file>");
            System.exit(1);
        }

        // Resolve to an absolute path so Gdx.files.absolute() always works.
        String scenarioPath = new File(args[0]).getAbsolutePath();

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // The loop runs at 60 Hz; we drive the fixed dt ourselves inside render().
        config.updatesPerSecond = 60;

        SimulationApp app = new SimulationApp(scenarioPath, System.out);

        // HeadlessApplication spawns its own "HeadlessApplication" daemon thread
        // for the main loop.  We must join it so stdout is fully flushed before
        // the JVM exits.
        HeadlessApplication headless = new HeadlessApplication(app, config);

        // Locate and join the headless loop thread.
        joinHeadlessThread();
    }

    /**
     * Blocks until the thread named {@code "HeadlessApplication"} has finished.
     * This thread is created internally by {@link HeadlessApplication} and runs
     * the game loop until {@code Gdx.app.exit()} sets {@code running = false}.
     */
    private static void joinHeadlessThread() throws InterruptedException {
        Thread target = null;

        // Poll briefly until the thread appears (it is spawned asynchronously).
        for (int attempts = 0; attempts < 200 && target == null; attempts++) {
            for (Thread t : Thread.getAllStackTraces().keySet()) {
                if ("HeadlessApplication".equals(t.getName())) {
                    target = t;
                    break;
                }
            }
            if (target == null) {
                Thread.sleep(10);
            }
        }

        if (target != null) {
            target.join();
        } else {
            // Should not happen, but wait a moment just in case.
            Thread.sleep(2000);
        }
    }
}
