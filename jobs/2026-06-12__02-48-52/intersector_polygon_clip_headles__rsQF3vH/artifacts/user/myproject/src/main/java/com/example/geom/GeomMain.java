package com.example.geom;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Entry point for the headless libGDX geometry CLI.
 * Passes the script-file path (first CLI argument) into the ApplicationListener
 * via a shared holder, then blocks until the HeadlessApplication loop finishes.
 */
public class GeomMain {

    public static void main(String[] args) throws InterruptedException {
        if (args.length < 1) {
            System.err.println("Usage: GeomMain <script-file-path>");
            System.exit(1);
        }

        String scriptPath = args[0];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // updatesPerSecond = 0 means the loop runs at maximum speed;
        // we do all our work in create() and exit immediately.
        config.updatesPerSecond = 0;

        GeomListener listener = new GeomListener(scriptPath);

        // HeadlessApplication launches its own thread; we hold a reference so we
        // can join it after the app calls Gdx.app.exit().
        HeadlessApplication app = new HeadlessApplication(listener, config);

        // Wait for the listener to signal that it has finished and Gdx.app.exit()
        // has been called, so that all stdout output is flushed before we return.
        listener.awaitDone();
    }
}
