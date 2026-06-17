package com.example.gdxgame;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Launcher for the headless libGDX keystroke-replay walker.
 *
 * <p>Usage: {@code gdx-game --input=<path>}
 *
 * <p>Reads a UTF-8 keystroke replay file, validates every token, constructs a
 * {@link ScriptedInput}, boots a {@link HeadlessApplication}, and waits for
 * it to finish.
 */
public class Main {

    public static void main(String[] args) throws Exception {
        String inputPath = null;
        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputPath = arg.substring("--input=".length());
            }
        }

        if (inputPath == null) {
            System.err.println("Error: --input=<file> argument is required");
            System.exit(1);
        }

        // Parse and validate the replay file before booting the application
        // so that input errors are caught early.
        List<Integer> keycodes = parseReplayFile(inputPath);

        ScriptedInput scriptedInput = new ScriptedInput(keycodes);
        WalkerGame game = new WalkerGame(scriptedInput);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Throttle to 60 updates/s to avoid spinning the CPU.
        config.updatesPerSecond = 60;

        // Boot the headless application on its own background thread.
        // WalkerGame.create() (called by the constructor) installs ScriptedInput
        // as Gdx.input, so no post-construction patching is required.
        HeadlessApplication app = new HeadlessApplication(game, config);

        // HeadlessApplication.mainLoopThread is protected; access it via
        // reflection so we can join it and prevent premature JVM exit.
        Thread mainLoopThread = getMainLoopThread(app);
        if (mainLoopThread != null) {
            mainLoopThread.join();
        }
    }

    /**
     * Accesses the protected {@code mainLoopThread} field of
     * {@link HeadlessApplication} via reflection.
     */
    private static Thread getMainLoopThread(HeadlessApplication app) {
        try {
            Field field = HeadlessApplication.class.getDeclaredField("mainLoopThread");
            field.setAccessible(true);
            return (Thread) field.get(app);
        } catch (Exception e) {
            System.err.println("Warning: could not access mainLoopThread: " + e.getMessage());
            return null;
        }
    }

    /**
     * Reads and validates the replay file, returning a list of
     * {@link com.badlogic.gdx.Input.Keys} constants.
     *
     * <p>Blank lines and lines starting with {@code #} are silently skipped.
     * Any unrecognised token causes the program to exit with a non-zero status.
     */
    private static List<Integer> parseReplayFile(String path) throws IOException {
        List<Integer> keycodes = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new FileReader(path, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue; // skip blank lines and comments
                }

                String upper = trimmed.toUpperCase();
                switch (upper) {
                    case "UP":    keycodes.add(Input.Keys.UP);    break;
                    case "DOWN":  keycodes.add(Input.Keys.DOWN);  break;
                    case "LEFT":  keycodes.add(Input.Keys.LEFT);  break;
                    case "RIGHT": keycodes.add(Input.Keys.RIGHT); break;
                    default:
                        System.err.println("Error: unknown key " + trimmed);
                        System.exit(1);
                }
            }
        }

        return keycodes;
    }
}
