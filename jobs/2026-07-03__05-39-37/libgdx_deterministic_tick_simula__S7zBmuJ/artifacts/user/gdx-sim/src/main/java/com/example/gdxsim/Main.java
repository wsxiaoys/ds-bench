package com.example.gdxsim;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Bootstrap entry point. Constructs a {@link HeadlessApplication} running the
 * deterministic simulation {@link SimListener}. The config and output paths are
 * passed as command-line arguments: {@code <config-path> <output-path>}.
 *
 * <p>After the simulation finishes, {@link SimListener#render()} calls
 * {@code Gdx.app.exit()} which asynchronously stops the main loop. We join the
 * main loop thread here so the JVM only exits once {@code dispose()} (which
 * writes the output file) has completed.</p>
 */
public class Main {

    public static void main(String[] args) throws InterruptedException {
        if (args.length < 2) {
            System.err.println("Usage: Main <config-path> <output-path>");
            System.exit(2);
        }

        String configPath = args[0];
        String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Run the main loop as fast as possible; ticks are driven by our own
        // counter, not by wall-clock pacing.
        config.updatesPerSecond = 0;

        SimListener listener = new SimListener(configPath, outputPath);
        JoinableHeadlessApplication app =
                new JoinableHeadlessApplication(listener, config);

        // Block until the main loop thread terminates, ensuring dispose() has
        // run and the output file has been flushed before the JVM exits.
        app.join();
    }

    /**
     * A thin {@link HeadlessApplication} subclass that exposes a {@link #join()}
     * method so callers can wait for the main loop thread (and thus
     * {@code dispose()}) to finish.
     */
    private static final class JoinableHeadlessApplication extends HeadlessApplication {
        JoinableHeadlessApplication(ApplicationListener listener,
                                    HeadlessApplicationConfiguration config) {
            super(listener, config);
        }

        void join() throws InterruptedException {
            // mainLoopThread is protected in HeadlessApplication, hence
            // accessible from this subclass.
            mainLoopThread.join();
        }
    }
}