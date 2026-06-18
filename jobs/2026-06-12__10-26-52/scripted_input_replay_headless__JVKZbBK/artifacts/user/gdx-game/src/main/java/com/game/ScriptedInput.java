package com.game;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Custom MockInput subclass that reads a keystroke replay file and
 * dispatches one keyDown event per render tick.
 */
public class ScriptedInput extends MockInput {

    private final List<Integer> keycodes = new ArrayList<>();
    private InputProcessor processor;
    private int currentIndex = 0;

    public ScriptedInput(Path filePath) throws IOException, UnknownKeyException {
        parseFile(filePath);
    }

    private void parseFile(Path filePath) throws IOException, UnknownKeyException {
        List<String> lines = Files.readAllLines(filePath);
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            String upper = trimmed.toUpperCase();
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
                    throw new UnknownKeyException(trimmed);
            }
        }
    }

    @Override
    public void setInputProcessor(InputProcessor processor) {
        this.processor = processor;
    }

    /**
     * Dispatch the next keycode in the sequence to the registered InputProcessor.
     *
     * @return true if a key was dispatched, false if the sequence is exhausted
     */
    public boolean tick() {
        if (currentIndex >= keycodes.size()) {
            return false;
        }
        if (processor != null) {
            processor.keyDown(keycodes.get(currentIndex));
        }
        currentIndex++;
        return true;
    }

    /**
     * Exception thrown when an unknown key token is encountered in the input file.
     */
    public static class UnknownKeyException extends Exception {
        private final String token;

        public UnknownKeyException(String token) {
            super(token);
            this.token = token;
        }

        public String getToken() {
            return token;
        }
    }
}