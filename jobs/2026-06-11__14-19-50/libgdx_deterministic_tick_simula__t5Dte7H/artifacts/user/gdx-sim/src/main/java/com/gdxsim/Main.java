package com.gdxsim;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.lang.reflect.Field;

public class Main {

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: gdx-sim <config-path> <output-path>");
            System.exit(1);
        }

        String configPath = args[0];
        String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Run as fast as possible, not throttled by wall-clock pacing
        config.updatesPerSecond = 0;

        SimulationListener listener = new SimulationListener(configPath, outputPath);
        HeadlessApplication app = new HeadlessApplication(listener, config);

        // HeadlessApplication spawns a new thread for the main loop.
        // Gdx.app.exit() is asynchronous: it posts a Runnable that sets
        // running=false, then the main loop breaks and calls dispose().
        // We must join the main loop thread so the JVM doesn't exit before
        // dispose() has flushed the output file.
        Field threadField = HeadlessApplication.class.getDeclaredField("mainLoopThread");
        threadField.setAccessible(true);
        Thread mainLoopThread = (Thread) threadField.get(app);
        mainLoopThread.join();

        // After the main loop thread finishes, dispose() has been called
        // and the output file has been flushed.
        System.exit(0);
    }
}
