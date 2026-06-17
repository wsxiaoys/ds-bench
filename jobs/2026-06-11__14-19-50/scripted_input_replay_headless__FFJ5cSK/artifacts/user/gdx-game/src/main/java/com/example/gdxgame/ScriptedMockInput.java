package com.example.gdxgame;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

final class ScriptedMockInput extends MockInput {
    private final List<Integer> keycodes;
    private int nextIndex;
    private InputProcessor inputProcessor;

    ScriptedMockInput(Path inputFile) throws IOException, UnknownKeyException {
        this.keycodes = parseInputFile(inputFile);
    }

    @Override
    public void setInputProcessor(InputProcessor processor) {
        this.inputProcessor = processor;
    }

    @Override
    public InputProcessor getInputProcessor() {
        return inputProcessor;
    }

    boolean dispatchNextTick() {
        if (nextIndex >= keycodes.size()) {
            return false;
        }

        InputProcessor processor = inputProcessor;
        int keycode = keycodes.get(nextIndex++);
        if (processor != null) {
            processor.keyDown(keycode);
        }
        return true;
    }

    private static List<Integer> parseInputFile(Path inputFile) throws IOException, UnknownKeyException {
        List<Integer> parsedKeycodes = new ArrayList<>();
        for (String line : Files.readAllLines(inputFile, StandardCharsets.UTF_8)) {
            String token = line.trim();
            if (token.isEmpty() || token.startsWith("#")) {
                continue;
            }

            parsedKeycodes.add(toKeycode(token));
        }
        return parsedKeycodes;
    }

    private static int toKeycode(String token) throws UnknownKeyException {
        return switch (token.toUpperCase()) {
            case "UP" -> Input.Keys.UP;
            case "DOWN" -> Input.Keys.DOWN;
            case "LEFT" -> Input.Keys.LEFT;
            case "RIGHT" -> Input.Keys.RIGHT;
            default -> throw new UnknownKeyException(token);
        };
    }

    static final class UnknownKeyException extends Exception {
        private final String token;

        UnknownKeyException(String token) {
            super(token);
            this.token = token;
        }

        String token() {
            return token;
        }
    }
}
