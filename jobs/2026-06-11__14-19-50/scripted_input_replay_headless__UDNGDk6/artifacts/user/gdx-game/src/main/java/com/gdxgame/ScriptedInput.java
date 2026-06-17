package com.gdxgame;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * A MockInput subclass that reads a keystroke sequence from a text file and
 * dispatches one keyDown event per render tick to the registered InputProcessor.
 *
 * MockInput's setInputProcessor is a no-op and getInputProcessor returns a
 * default InputAdapter, so we override both to properly store and retrieve
 * the processor.
 */
public class ScriptedInput extends MockInput {

    private final List<Integer> keyQueue = new ArrayList<>();
    private int tickIndex = 0;
    private InputProcessor inputProcessor;

    /**
     * Parses the keystroke file. Valid tokens are UP, DOWN, LEFT, RIGHT (case-insensitive).
     * Blank lines and lines starting with '#' are skipped.
     *
     * @param filePath path to the keystroke replay file
     * @throws IOException if the file cannot be read
     * @throws IllegalArgumentException if any non-blank, non-comment line contains an unknown token
     */
    public ScriptedInput(Path filePath) throws IOException, IllegalArgumentException {
        try (BufferedReader reader = Files.newBufferedReader(filePath)) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                int keycode = parseKey(line);
                if (keycode < 0) {
                    throw new IllegalArgumentException("Error: unknown key " + line);
                }
                keyQueue.add(keycode);
            }
        }
    }

    /**
     * Returns the total number of valid keystrokes in the queue.
     */
    public int getTotalKeys() {
        return keyQueue.size();
    }

    /**
     * Returns true if all keystrokes have been dispatched.
     */
    public boolean isExhausted() {
        return tickIndex >= keyQueue.size();
    }

    /**
     * Dispatches the next keystroke in the queue by calling keyDown on the
     * currently registered InputProcessor. Call this once per render tick.
     * If the queue is exhausted, this method does nothing.
     */
    public void dispatchNextKey() {
        if (isExhausted()) {
            return;
        }
        int keycode = keyQueue.get(tickIndex);
        if (inputProcessor != null) {
            inputProcessor.keyDown(keycode);
        }
        tickIndex++;
    }

    @Override
    public void setInputProcessor(InputProcessor processor) {
        this.inputProcessor = processor;
    }

    @Override
    public InputProcessor getInputProcessor() {
        return inputProcessor;
    }

    private static int parseKey(String token) {
        switch (token.toUpperCase()) {
            case "UP":
                return Input.Keys.UP;
            case "DOWN":
                return Input.Keys.DOWN;
            case "LEFT":
                return Input.Keys.LEFT;
            case "RIGHT":
                return Input.Keys.RIGHT;
            default:
                return -1;
        }
    }
}
