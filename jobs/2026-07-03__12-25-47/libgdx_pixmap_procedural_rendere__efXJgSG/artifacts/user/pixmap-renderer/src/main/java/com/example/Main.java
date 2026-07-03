package com.example;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.lang.reflect.Field;

/**
 * Boots a HeadlessApplication that runs the procedural Pixmap renderer.
 * Blocks until the listener signals completion (or fails) via Gdx.app.exit().
 */
public class Main {

    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: Main <input-script> <output-png>");
            System.exit(2);
        }

        String inputPath = args[0];
        String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Headless runs create() on its own thread; updatesPerSecond only affects the
        // post-create render loop cadence.
        config.updatesPerSecond = 30;

        PixmapRenderer listener = new PixmapRenderer(inputPath, outputPath);
        HeadlessApplication app = new HeadlessApplication(listener, config);

        // Block this thread until the libGDX main loop is no longer running.
        // HeadlessApplication sets its `running` field to false on exit().
        long deadline = System.currentTimeMillis() + 60_000L;
        while (System.currentTimeMillis() < deadline) {
            if (!isRunning(app)) {
                break;
            }
            try {
                Thread.sleep(25);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        // The HeadlessApplication's exit sets running=false; ensure clean shutdown.
        try {
            app.exit();
        } catch (Throwable ignored) {
        }
    }

    private static boolean isRunning(HeadlessApplication app) {
        // The `running` field is protected, so use reflection to inspect it.
        try {
            Field f = HeadlessApplication.class.getDeclaredField("running");
            f.setAccessible(true);
            return f.getBoolean(app);
        } catch (Throwable t) {
            // If we cannot read the field, fall back to the listener's own state.
            return true;
        }
    }
}
