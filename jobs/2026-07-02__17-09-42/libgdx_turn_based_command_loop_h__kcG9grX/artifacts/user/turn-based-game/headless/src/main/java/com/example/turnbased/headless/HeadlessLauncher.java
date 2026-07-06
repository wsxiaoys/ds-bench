package com.example.turnbased.headless;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import com.example.turnbased.core.GameListener;
import com.example.turnbased.core.ScriptedMockInput;

import java.lang.reflect.Field;
import java.util.concurrent.CountDownLatch;

/**
 * Entry point for the headless turn-based game. Boots a
 * {@link HeadlessApplication}, swaps in a scripted {@link ScriptedMockInput},
 * runs until the listener flushes its transcript, then waits for the
 * headless main-loop thread to terminate so the JVM can exit cleanly with
 * status code {@code 0}.
 */
public final class HeadlessLauncher {

    private HeadlessLauncher() {}

    public static void main(String[] args) throws Exception {
        Args cli = Args.parse(args);

        HeadlessApplicationConfiguration cfg = new HeadlessApplicationConfiguration();
        cfg.updatesPerSecond = 0; // run as fast as possible

        ScriptedMockInput scriptedInput = new ScriptedMockInput();
        ApplicationListener listener = new GameListener(
            scriptedInput, cli.mapPath, cli.commandsPath, cli.transcriptPath);

        HeadlessApplication app = new HeadlessApplication(listener, cfg);

        // Replace Gdx.input *before* the first render tick fires. This is the
        // hand-off required by the spec.
        Gdx.input = scriptedInput;

        CountDownLatch latch = ((GameListener) listener).getDoneLatch();
        latch.await();

        // The listener has finished writing the transcript; now wait for the
        // headless main-loop thread to actually exit so no non-daemon thread
        // outlives the launcher.
        Thread mainLoopThread = readMainLoopThread(app);
        mainLoopThread.join();
        // Returning from main lets the JVM exit cleanly with status 0.
    }

    private static Thread readMainLoopThread(HeadlessApplication app)
            throws ReflectiveOperationException {
        Field f = HeadlessApplication.class.getDeclaredField("mainLoopThread");
        f.setAccessible(true);
        return (Thread) f.get(app);
    }

    /** Tiny holder for the three required CLI flags. */
    private static final class Args {
        final String mapPath;
        final String commandsPath;
        final String transcriptPath;

        private Args(String mapPath, String commandsPath, String transcriptPath) {
            this.mapPath = mapPath;
            this.commandsPath = commandsPath;
            this.transcriptPath = transcriptPath;
        }

        static Args parse(String[] argv) {
            String map = null, commands = null, transcript = null;
            for (String arg : argv) {
                if (arg.startsWith("--map=")) {
                    map = arg.substring("--map=".length());
                } else if (arg.startsWith("--commands=")) {
                    commands = arg.substring("--commands=".length());
                } else if (arg.startsWith("--transcript=")) {
                    transcript = arg.substring("--transcript=".length());
                }
                // Anything else is silently ignored; the spec only requires
                // us to honour these three.
            }
            if (map == null || commands == null || transcript == null) {
                String msg = "Usage: --map=<PATH> --commands=<PATH> --transcript=<PATH>";
                System.err.println(msg);
                throw new IllegalArgumentException(msg);
            }
            return new Args(map, commands, transcript);
        }
    }
}