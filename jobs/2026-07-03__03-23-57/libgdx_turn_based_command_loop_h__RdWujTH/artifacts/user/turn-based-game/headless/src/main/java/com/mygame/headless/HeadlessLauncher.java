package com.mygame.headless;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.mygame.core.GameInput;
import com.mygame.core.GameListener;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
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
            System.err.println("Error: Missing required arguments.");
            System.err.println("Usage: --map=<absolute_path> --commands=<absolute_path> --transcript=<absolute_path>");
            System.exit(1);
        }

        CountDownLatch latch = new CountDownLatch(1);
        GameListener listener = new GameListener(mapPath, commandsPath, transcriptPath, latch);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 1000;

        try {
            HeadlessApplication app = new HeadlessApplication(listener, config);

            List<String> commands = readCommands(commandsPath);
            GameInput gameInput = new GameInput(commands);
            Gdx.input = gameInput;

            latch.await();
        } catch (Throwable t) {
            t.printStackTrace();
            System.exit(1);
        }

        System.exit(0);
    }

    private static List<String> readCommands(String path) throws IOException {
        List<String> commands = new ArrayList<>();
        File file = new File(path);
        if (!file.exists()) {
            throw new FileNotFoundException("Commands file not found: " + path);
        }
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                commands.add(line);
            }
        }
        return commands;
    }
}
