package com.example;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Entry point. Bootstraps a HeadlessApplication that samples an interpolation
 * curve and writes the result to a file.
 *
 * Usage: ./gradlew run --args="<config-path> <output-path>"
 */
public class CurveSamplerMain {

    public static void main(String[] args) {
        if (args.length != 2) {
            System.err.println("Usage: <config-path> <output-path>");
            System.exit(1);
        }

        // Pass CLI args to the listener via a static holder
        CurveSamplerListener.ConfigHolder.configPath = args[0];
        CurveSamplerListener.ConfigHolder.outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // 0 = run as fast as possible without wall-clock pacing
        config.updatesPerSecond = 0;

        CurveSamplerListener listener = new CurveSamplerListener();
        HeadlessApplication app = new HeadlessApplication(listener, config);

        // HeadlessApplication spawns a daemon thread for the main loop.
        // We need to join it so the JVM doesn't exit before dispose() runs.
        // The daemon thread is accessible via the application's internals.
        // Since the thread is a daemon, the JVM would exit immediately unless
        // we keep the main thread alive. We do this by sleeping briefly and
        // polling for completion.

        // Poll until the app exits
        try {
            // The headless app main loop runs on a daemon thread named "HeadlessApplication"
            // Find it and join it
            Thread[] threads = new Thread[Thread.activeCount() + 10];
            int count = Thread.enumerate(threads);
            Thread headlessThread = null;
            for (int i = 0; i < count; i++) {
                if ("HeadlessApplication".equals(threads[i].getName())) {
                    headlessThread = threads[i];
                    break;
                }
            }

            if (headlessThread != null) {
                headlessThread.join();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
