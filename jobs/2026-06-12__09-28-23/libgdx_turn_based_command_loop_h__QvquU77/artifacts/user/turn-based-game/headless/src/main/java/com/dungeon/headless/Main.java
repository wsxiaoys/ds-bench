package com.dungeon.headless;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;
import com.dungeon.core.GameListener;
import com.dungeon.core.ScriptedMockInput;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;

/**
 * Headless launcher. Parses CLI arguments, loads the command file, boots the
 * HeadlessApplication with our custom ScriptedMockInput, and waits for it to finish.
 */
public class Main {

    public static void main(String[] args) {
        String mapPath = null;
        String commandsPath = null;
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
            System.err.println("Usage: --map=<absolute_path> --commands=<absolute_path> --transcript=<absolute_path>");
            System.exit(1);
        }

        // Load commands from the commands file
        List<String> commands = loadCommands(commandsPath);

        // Create the listener
        GameListener listener = new GameListener(mapPath, transcriptPath);

        // Configure headless application
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0; // run as fast as possible

        // Use a latch to wait for the headless thread to finish
        CountDownLatch latch = new CountDownLatch(1);

        // Boot the headless application
        HeadlessApplication app = new HeadlessApplication(listener, config);

        // Swap Gdx.input for our scripted mock input BEFORE the first render tick
        ScriptedMockInput scriptedInput = new ScriptedMockInput(commands);
        Gdx.input = scriptedInput;

        // Add a lifecycle listener to detect when the app exits
        app.addLifecycleListener(new com.badlogic.gdx.LifecycleListener() {
            @Override
            public void pause() {
            }

            @Override
            public void resume() {
            }

            @Override
            public void dispose() {
                latch.countDown();
            }
        });

        // Wait for the headless main-loop thread to finish
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static List<String> loadCommands(String commandsPath) {
        List<String> commands = new ArrayList<>();
        // Use java.io to read the commands file since Gdx.files may not be initialized yet
        try {
            java.io.File file = new java.io.File(commandsPath);
            java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(new java.io.FileInputStream(file), "UTF-8"));
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                commands.add(trimmed);
            }
            reader.close();
        } catch (java.io.IOException e) {
            System.err.println("Failed to read commands file: " + commandsPath);
            System.exit(1);
        }
        return commands;
    }
}
