package com.example.gdxgame;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicIntegerArray;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Launcher entrypoint for the headless scripted-input walker simulation.
 *
 * <p>Usage:</p>
 * <pre>
 *   gdx-game --input=&lt;path-to-replay-file&gt;
 * </pre>
 *
 * <p>The launcher reads and validates the replay file up-front so that
 * malformed input causes an immediate non-zero exit with a descriptive
 * error on stderr and no {@code Final position:} line is printed. After
 * successful validation the launcher constructs a
 * {@link HeadlessApplication}, swaps the default {@code MockInput} for
 * the scripted subclass, blocks the main thread on a latch until the
 * simulation finishes, and then exits with status {@code 0}.</p>
 */
public final class GdxGameLauncher {

    private static final int LATCH_TIMEOUT_SECONDS = 120;

    private GdxGameLauncher() {
    }

    public static void main(String[] args) {
        String inputPath = parseInputArg(args);
        if (inputPath == null) {
            System.err.println("Error: missing required --input=<path> argument");
            System.exit(2);
            return;
        }

        Path path = Paths.get(inputPath);
        if (!Files.isRegularFile(path)) {
            System.err.println("Error: input file not found: " + inputPath);
            System.exit(2);
            return;
        }

        ScriptedInput scriptedInput;
        try {
            scriptedInput = new ScriptedInput(path);
        } catch (ScriptedInput.UnknownKeyException e) {
            System.err.println("Error: unknown key " + e.getToken());
            System.exit(1);
            return;
        } catch (Exception e) {
            System.err.println("Error: failed to load input file: " + e.getMessage());
            System.exit(2);
            return;
        }

        CountDownLatch finished = new CountDownLatch(1);
        AtomicIntegerArray finalPosition = new AtomicIntegerArray(new int[]{0, 0});

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Throttle the main loop so the simulation does not spin the CPU
        // between the (possibly few) scripted keystrokes.
        config.updatesPerSecond = 60;

        GdxGameListener listener = new GdxGameListener(scriptedInput, finished, finalPosition);
        HeadlessApplication application = new HeadlessApplication(listener, config);
        // Silence the unused-warning while keeping the local handle for
        // documentation; we don't need to interact with the application
        // again because the latch-based wait below covers teardown.
        if (application == null) {
            System.err.println("Error: failed to start HeadlessApplication");
            System.exit(5);
            return;
        }

        // Replace the default MockInput with our scripted subclass so that
        // any framework code that calls Gdx.input.setInputProcessor(...) or
        // Gdx.input.getInputProcessor() sees our implementation.
        com.badlogic.gdx.Gdx.input = scriptedInput;

        try {
            if (!finished.await(LATCH_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                System.err.println("Error: simulation timed out");
                System.exit(3);
                return;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("Error: launcher interrupted");
            System.exit(4);
            return;
        }

        // The listener printed the final position to stdout before releasing
        // the latch and called Gdx.app.exit(), so the headless main loop has
        // already signalled shutdown by the time we get here.
        System.exit(0);
    }

    /**
     * Pull the {@code --input=<path>} flag out of the argument vector.
     * Returns {@code null} if the flag is missing.
     */
    private static String parseInputArg(String[] args) {
        for (String arg : args) {
            if (arg == null) {
                continue;
            }
            if (arg.startsWith("--input=")) {
                return arg.substring("--input=".length());
            }
        }
        return null;
    }
}