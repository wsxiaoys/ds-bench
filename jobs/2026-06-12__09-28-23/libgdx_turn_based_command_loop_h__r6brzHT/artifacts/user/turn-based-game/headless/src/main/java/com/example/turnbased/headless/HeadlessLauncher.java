package com.example.turnbased.headless;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.example.turnbased.core.DungeonGame;
import com.example.turnbased.core.ScriptedCommandInput;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class HeadlessLauncher {
    private HeadlessLauncher() {
    }

    public static void main(String[] args) throws InterruptedException {
        CliArguments cliArguments = parseArguments(args);
        List<String> commands = loadCommands(cliArguments.commandsPath());

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        DungeonGame game = new DungeonGame(cliArguments.mapPath(), cliArguments.transcriptPath());
        new HeadlessApplication(game, config);
        Gdx.input = new ScriptedCommandInput(commands);

        game.awaitDisposed();
    }

    private static CliArguments parseArguments(String[] args) {
        Map<String, String> values = new HashMap<>();
        for (String arg : args) {
            if (arg.startsWith("--map=")) {
                values.put("map", arg.substring("--map=".length()));
            } else if (arg.startsWith("--commands=")) {
                values.put("commands", arg.substring("--commands=".length()));
            } else if (arg.startsWith("--transcript=")) {
                values.put("transcript", arg.substring("--transcript=".length()));
            } else {
                throw new IllegalArgumentException("Unknown argument: " + arg);
            }
        }

        String mapPath = requireAbsolute(values, "map");
        String commandsPath = requireAbsolute(values, "commands");
        String transcriptPath = requireAbsolute(values, "transcript");
        return new CliArguments(mapPath, commandsPath, transcriptPath);
    }

    private static String requireAbsolute(Map<String, String> values, String name) {
        String value = values.get(name);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing required argument --" + name + "=<absolute_path>");
        }
        if (!Path.of(value).isAbsolute()) {
            throw new IllegalArgumentException("Argument --" + name + " must be an absolute path: " + value);
        }
        return value;
    }

    private static List<String> loadCommands(String commandsPath) {
        List<String> commands = new ArrayList<>();
        try {
            for (String line : Files.readAllLines(Path.of(commandsPath), StandardCharsets.UTF_8)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                commands.add(trimmed);
            }
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to read commands file: " + commandsPath, exception);
        }
        return commands;
    }

    private record CliArguments(String mapPath, String commandsPath, String transcriptPath) {
    }
}
