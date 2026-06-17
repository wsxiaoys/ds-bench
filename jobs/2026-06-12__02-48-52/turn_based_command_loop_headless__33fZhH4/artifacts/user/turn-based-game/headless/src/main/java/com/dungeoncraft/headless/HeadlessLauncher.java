package com.dungeoncraft.headless;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.dungeoncraft.core.GameListener;
import com.dungeoncraft.core.ScriptedInput;

import java.util.List;
import java.util.concurrent.CountDownLatch;

/**
 * Entry-point for the headless dungeon-crawler.
 *
 * <h2>Usage</h2>
 * <pre>
 *   ./gradlew --no-daemon -q :headless:run \
 *     --args="--map=&lt;ABS&gt; --commands=&lt;ABS&gt; --transcript=&lt;ABS&gt;"
 * </pre>
 *
 * <p>The three flags may appear in any order.
 */
public final class HeadlessLauncher {

    private HeadlessLauncher() {}

    public static void main(String[] args) throws InterruptedException {

        // ── parse CLI arguments ───────────────────────────────────────────────
        String mapPath        = null;
        String commandsPath   = null;
        String transcriptPath = null;

        for (String arg : args) {
            if (arg.startsWith("--map=")) {
                mapPath = arg.substring("--map=".length());
            } else if (arg.startsWith("--commands=")) {
                commandsPath = arg.substring("--commands=".length());
            } else if (arg.startsWith("--transcript=")) {
                transcriptPath = arg.substring("--transcript=".length());
            }
        }

        if (mapPath == null || commandsPath == null || transcriptPath == null) {
            System.err.println("Usage: HeadlessLauncher " +
                    "--map=<path> --commands=<path> --transcript=<path>");
            System.exit(1);
        }

        // ── set up the HeadlessApplication ────────────────────────────────────
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Run as fast as possible: 0 means unlimited updates per second.
        config.updatesPerSecond = 0;

        // We need a latch so the main thread waits for the game loop to finish
        // (HeadlessApplication runs its loop on a separate thread).
        CountDownLatch doneLatch = new CountDownLatch(1);

        // Build a GameListener without commands yet — we will read them after
        // Gdx.files is initialised (inside create()), but the ScriptedInput
        // must exist before the HeadlessApplication starts so we can swap it
        // in immediately after construction.
        //
        // Strategy: create a thin wrapper listener that:
        //   1. reads commands in create() using Gdx.files,
        //   2. delegates all calls to a GameListener,
        //   3. counts down the latch in dispose().
        final String finalMapPath        = mapPath;
        final String finalCommandsPath   = commandsPath;
        final String finalTranscriptPath = transcriptPath;

        // Placeholder ScriptedInput — we replace Gdx.input with the real one
        // inside the DelegatingListener.create() before render() is ever called.
        // We use a single-element array so the anonymous class can reference it.
        final ScriptedInput[] inputHolder = new ScriptedInput[1];
        final GameListener[]  listenerHolder = new GameListener[1];

        com.badlogic.gdx.ApplicationListener wrapper =
                new com.badlogic.gdx.ApplicationListener() {

            @Override
            public void create() {
                // Gdx.files is now live — load commands.
                List<String> commands =
                        GameListener.loadCommands(finalCommandsPath);

                ScriptedInput si = new ScriptedInput(commands);
                inputHolder[0]   = si;

                GameListener gl  = new GameListener(
                        finalMapPath, finalTranscriptPath, si);
                listenerHolder[0] = gl;

                // Install our scripted input BEFORE the first render() fires.
                // Gdx.input was set to a vanilla MockInput by HeadlessApplication
                // during construction; we swap it here.
                Gdx.input = si;

                // Delegate create().
                gl.create();
            }

            @Override
            public void render() {
                listenerHolder[0].render();
            }

            @Override
            public void resize(int width, int height) {
                listenerHolder[0].resize(width, height);
            }

            @Override
            public void pause() {
                listenerHolder[0].pause();
            }

            @Override
            public void resume() {
                listenerHolder[0].resume();
            }

            @Override
            public void dispose() {
                if (listenerHolder[0] != null) {
                    listenerHolder[0].dispose();
                }
                doneLatch.countDown();
            }
        };

        // Construct the application.  This starts the game-loop thread.
        new HeadlessApplication(wrapper, config);

        // Block the main thread until the loop thread calls dispose() and
        // counts down the latch, so the transcript is fully written before
        // the JVM exits.
        doneLatch.await();
    }
}
