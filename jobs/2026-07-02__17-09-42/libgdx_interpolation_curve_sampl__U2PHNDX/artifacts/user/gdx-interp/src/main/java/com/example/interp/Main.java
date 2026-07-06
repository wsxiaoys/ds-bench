package com.example.interp;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Entry point that bootstraps the libGDX headless application and blocks the
 * JVM until the main loop has fully terminated.
 */
public final class Main {

    private Main() {
    }

    public static void main(String[] args) {
        if (args.length != 2) {
            System.err.println("Usage: <config-path> <output-path>");
            System.exit(1);
        }

        String configPath = args[0];
        String outputPath = args[1];

        InterpApp listener = new InterpApp(configPath, outputPath);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Run the main loop as fast as possible without wall-clock pacing;
        // the work is a deterministic finite sweep.
        config.updatesPerSecond = 0;

        new HeadlessApplication(listener, config);

        try {
            listener.awaitTermination();
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            System.err.println("Interrupted while waiting for application termination");
            System.exit(1);
            return;
        }

        System.exit(listener.getExitCode());
    }
}