package com.mygame.headless;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.mygame.core.MyGame;
import com.mygame.core.ScriptedInput;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;
import java.util.concurrent.CountDownLatch;

public class HeadlessLauncher {
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
            System.err.println("Usage: HeadlessLauncher --map=<path> --commands=<path> --transcript=<path>");
            System.exit(1);
        }

        ScriptedInput input = new ScriptedInput();

        // Read commands file and populate the input queue
        try {
            List<String> lines = Files.readAllLines(Paths.get(commandsPath), StandardCharsets.UTF_8);
            for (String line : lines) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                input.addCommand(trimmed);
            }
        } catch (Exception e) {
            System.err.println("Failed to read commands file: " + commandsPath);
            e.printStackTrace();
            System.exit(1);
        }

        CountDownLatch latch = new CountDownLatch(1);
        MyGame game = new MyGame(mapPath, transcriptPath, input, latch);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0; // unlimited / as fast as possible

        HeadlessApplication app = new HeadlessApplication(game, config);
        Gdx.input = input; // Replace Gdx.input with our scripted subclass right after constructing HeadlessApplication

        // Wait for the game loop to finish before returning
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("Main thread interrupted while waiting for game loop to finish.");
        }

        System.exit(0);
    }
}
