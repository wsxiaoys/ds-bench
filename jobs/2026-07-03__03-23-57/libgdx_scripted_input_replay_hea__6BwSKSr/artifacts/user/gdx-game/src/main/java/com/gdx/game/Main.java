package com.gdx.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        String inputPath = null;
        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputPath = arg.substring("--input=".length());
            }
        }

        if (inputPath == null) {
            System.err.println("Error: Missing --input=<path> argument");
            System.exit(1);
        }

        File file = new File(inputPath);
        if (!file.exists()) {
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

                if (trimmed.equalsIgnoreCase("UP")) {
                    keycodes.add(Input.Keys.UP);
                } else if (trimmed.equalsIgnoreCase("DOWN")) {
                    keycodes.add(Input.Keys.DOWN);
                } else if (trimmed.equalsIgnoreCase("LEFT")) {
                    keycodes.add(Input.Keys.LEFT);
                } else if (trimmed.equalsIgnoreCase("RIGHT")) {
                    keycodes.add(Input.Keys.RIGHT);
                } else {
                    System.err.println("Error: unknown key " + trimmed);
                    System.exit(1);
                }
            }
        } catch (IOException e) {
            System.err.println("Error reading file: " + e.getMessage());
            System.exit(1);
        }

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 100;

        ReplayInput replayInput = new ReplayInput(keycodes);
        WalkerListener listener = new WalkerListener(replayInput);

        HeadlessApplication app = new HeadlessApplication(listener, config);
        Gdx.input = replayInput;

        try {
            java.lang.reflect.Field field = HeadlessApplication.class.getDeclaredField("mainLoopThread");
            field.setAccessible(true);
            Thread thread = (Thread) field.get(app);
            if (thread != null) {
                thread.join();
            }
        } catch (Exception e) {
            System.err.println("Error waiting for headless main loop thread: " + e.getMessage());
            System.exit(1);
        }

        System.out.println("Final position: (" + listener.getX() + ", " + listener.getY() + ")");
        System.exit(0);
    }
}
