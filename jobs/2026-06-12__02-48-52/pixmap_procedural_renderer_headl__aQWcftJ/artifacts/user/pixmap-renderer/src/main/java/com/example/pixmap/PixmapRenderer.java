package com.example.pixmap;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Entry point: boots a libGDX {@link HeadlessApplication} that performs all
 * pixmap work inside the libGDX life-cycle and then shuts down cleanly.
 *
 * <p>Usage: {@code PixmapRenderer <input-script> <output.png>}
 */
public final class PixmapRenderer {

    private PixmapRenderer() {}

    public static void main(String[] args) throws InterruptedException {
        if (args.length < 2) {
            System.err.println("Usage: PixmapRenderer <input-script> <output.png>");
            System.exit(1);
        }

        String inputPath  = args[0];
        String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // No render loop needed — we do everything in create() and exit immediately.
        config.updatesPerSecond = -1;

        DrawingListener listener = new DrawingListener(inputPath, outputPath);

        // HeadlessApplication runs on its own thread; the constructor returns
        // only after the thread has been started (not after create() finishes).
        HeadlessApplication app = new HeadlessApplication(listener, config);

        // Wait for the libGDX thread to finish (it calls Gdx.app.exit() when done).
        listener.awaitDone();

        // Give HeadlessApplication a moment to flush and join its own thread.
        // The internal thread is a daemon thread so we join via the latch above.
        // Retrieve the summary AFTER the latch to guarantee the file is written.
        String summary = listener.getSummary();
        System.out.println(summary);

        // Force JVM exit so no background threads keep it alive.
        System.exit(listener.getExitCode());
    }
}
