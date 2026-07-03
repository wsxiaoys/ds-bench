package com.pochi.pixmaprenderer;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.backends.headless.HeadlessNativesLoader;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

/**
 * Command-line entrypoint that boots a {@link HeadlessApplication}, dispatches a parsed
 * drawing script through {@link PixmapRendererListener}, and prints the summary line
 * that {@code run.sh} looks for.
 *
 * <p>Usage: {@code java HeadlessPixmapLauncher <input-script> <output-png>}</p>
 */
public final class HeadlessPixmapLauncher {

    private HeadlessPixmapLauncher() {
    }

    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println(
                "Usage: HeadlessPixmapLauncher <input-script> <output-png>");
            System.exit(2);
        }

        Path inputPath = Paths.get(args[0]).toAbsolutePath();
        Path outputPath = Paths.get(args[1]).toAbsolutePath();

        // Parse script on the main thread before touching libGDX so that any
        // IO / parse errors are reported before we boot a native-backed backend.
        final List<ScriptParser.Command> commands;
        try {
            commands = ScriptParser.parse(inputPath);
        } catch (IOException ioe) {
            System.err.println(
                "Failed to read input script '" + inputPath + "': " + ioe);
            System.exit(3);
            return;
        } catch (ScriptParser.ScriptParseException spe) {
            System.err.println(
                "Bad input script '" + inputPath + "': " + spe.getMessage());
            System.exit(3);
            return;
        }

        // Make sure the libGDX native libraries are extracted and loaded before
        // the HeadlessApplication thread starts touching JNI-backed classes.
        HeadlessNativesLoader.load();

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Up the iteration count so any postRunnable-during-create work still gets
        // a chance to fire before shutdown logic runs.
        config.updatesPerSecond = -1;

        PixmapRendererListener listener =
            new PixmapRendererListener(commands, outputPath);

        HeadlessApplication app = new HeadlessApplication(listener, config);

        Throwable renderFailure = null;
        try {
            listener.awaitCompletion();
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            renderFailure = ie;
        }

        if (listener.getFailure() != null) {
            renderFailure = listener.getFailure();
        }

        // Give libGDX a moment to actually wind down its thread before we tear
        // the JVM down — otherwise the PNG writer can race with shutdown.
        try {
            app.exit();
        } catch (Throwable ignored) {
            // Already shutting down; ignore.
        }

        if (renderFailure != null) {
            System.err.println("Render failed: " + renderFailure);
            renderFailure.printStackTrace(System.err);
            System.exit(4);
            return;
        }

        // Print the summary line. Format must remain stable so the test harness
        // can parse it.
        System.out.println(
            "RENDER_OK width=" + listener.getWidth()
                + " height=" + listener.getHeight()
                + " commands=" + listener.getCommandCount());

        System.exit(0);
    }
}
