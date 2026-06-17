package com.mygdx.game;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class Main {
    public static void main(String[] args) {
        String inputPath = null;
        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputPath = arg.substring("--input=".length());
            }
        }

        if (inputPath == null || inputPath.isEmpty()) {
            System.err.println("Error: Missing or empty --input=<path> argument");
            System.exit(1);
        }

        File file = new File(inputPath);
        if (!file.exists() || !file.isFile()) {
            System.err.println("Error: File not found: " + inputPath);
            System.exit(1);
        }

        List<Integer> keycodes = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) {
                    continue;
                }
                if (trimmed.startsWith("#")) {
                    continue;
                }
                String upper = trimmed.toUpperCase(Locale.ROOT);
                switch (upper) {
                    case "UP":
                        keycodes.add(Input.Keys.UP);
                        break;
                    case "DOWN":
                        keycodes.add(Input.Keys.DOWN);
                        break;
                    case "LEFT":
                        keycodes.add(Input.Keys.LEFT);
                        break;
                    case "RIGHT":
                        keycodes.add(Input.Keys.RIGHT);
                        break;
                    default:
                        System.err.println("Error: unknown key " + trimmed);
                        System.exit(1);
                }
            }
        } catch (IOException e) {
            System.err.println("Error reading file: " + e.getMessage());
            System.exit(1);
        }

        // Initialize and run the Headless Walker application
        ReplayInput replayInput = new ReplayInput(keycodes);
        WalkerGame game = new WalkerGame(replayInput);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60; // Throttle CPU usage

        HeadlessApplication app = new HeadlessApplication(game, config);

        // Block launcher's main thread until simulation finishes
        try {
            Field field = HeadlessApplication.class.getDeclaredField("mainLoopThread");
            field.setAccessible(true);
            Thread thread = (Thread) field.get(app);
            if (thread != null) {
                thread.join();
            } else {
                while (!game.isFinished()) {
                    Thread.sleep(10);
                }
            }
        } catch (Exception e) {
            while (!game.isFinished()) {
                try {
                    Thread.sleep(10);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        // Print final position
        System.out.println("Final position: (" + game.getX() + ", " + game.getY() + ")");
        System.exit(0);
    }
}
