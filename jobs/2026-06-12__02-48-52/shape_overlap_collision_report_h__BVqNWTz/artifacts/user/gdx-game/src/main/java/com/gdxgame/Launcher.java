package com.gdxgame;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.util.concurrent.CountDownLatch;

/**
 * Entry point. Parses --shapes=<path> and --output=<path>, boots a
 * HeadlessApplication, waits for it to finish, and exits with an
 * appropriate status code.
 *
 * The HeadlessApplication boots its ApplicationListener on a background
 * thread. We use a CountDownLatch that the CollisionListener counts down
 * once it has called Gdx.app.exit(), so the main thread can block until
 * processing is complete before checking for errors and calling System.exit.
 */
public class Launcher {

    public static void main(String[] args) throws InterruptedException {
        String shapesPath = null;
        String outputPath = null;

        for (String arg : args) {
            if (arg.startsWith("--shapes=")) {
                shapesPath = arg.substring("--shapes=".length());
            } else if (arg.startsWith("--output=")) {
                outputPath = arg.substring("--output=".length());
            }
        }

        if (shapesPath == null || shapesPath.isBlank()) {
            System.err.println("Error: missing required argument --shapes=<path>");
            System.exit(1);
        }
        if (outputPath == null || outputPath.isBlank()) {
            System.err.println("Error: missing required argument --output=<path>");
            System.exit(1);
        }

        // Latch released when create() finishes (after Gdx.app.exit() is called).
        CountDownLatch done = new CountDownLatch(1);
        CollisionListener listener = new CollisionListener(shapesPath, outputPath, done);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // -1 means run as fast as possible (no sleep between updates).
        config.updatesPerSecond = -1;

        // This constructor starts the headless main loop on a new thread.
        new HeadlessApplication(listener, config);

        // Block until the listener signals completion.
        done.await();

        if (listener.errorMessage != null) {
            System.err.println(listener.errorMessage);
            System.exit(1);
        }

        System.exit(0);
    }
}
