package com.example.gdxgame;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

/**
 * A {@link MockInput} subclass that replays a scripted keystroke sequence
 * loaded from a text file. Each call to {@link #processNext()} reads the
 * next non-blank, non-comment line from the file, parses it into a libGDX
 * keycode, and forwards it to the currently registered {@link InputProcessor}
 * via {@code keyDown(int)}.
 *
 * <p>The constructor performs eager validation of the file. If a non-blank,
 * non-comment line contains a token other than {@code UP}, {@code DOWN},
 * {@code LEFT}, or {@code RIGHT}, an {@link UnknownKeyException} is thrown
 * so the launcher can fail fast with a descriptive error message.</p>
 */
public class ScriptedInput extends MockInput {

    /** Thrown when the replay file contains a non-blank, non-comment token
     *  that does not map to a recognised keystroke. */
    public static final class UnknownKeyException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final String token;

        public UnknownKeyException(String token) {
            super("unknown key: " + token);
            this.token = token;
        }

        public String getToken() {
            return token;
        }
    }

    /** Holds the parsed, validated keycodes in the order they should be
     *  dispatched. */
    private final List<Integer> keycodes;

    /** Index of the next keycode to dispatch via {@link #processNext()}. */
    private int cursor;

    /** The {@link InputProcessor} most recently registered through
     *  {@link #setInputProcessor(InputProcessor)}. The reference is kept
     *  here because the upstream {@link MockInput} ignores the assignment. */
    private InputProcessor processor;

    /**
     * Load a replay file from {@code path}, parse every non-blank,
     * non-comment line, and validate the keystroke names.
     *
     * @throws IOException if the file cannot be read
     * @throws UnknownKeyException if any non-blank, non-comment line
     *         contains an unrecognised keystroke name
     */
    public ScriptedInput(Path path) throws IOException {
        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
        List<Integer> parsed = new ArrayList<Integer>();
        for (String raw : lines) {
            String token = raw == null ? "" : raw.trim();
            if (token.isEmpty() || token.startsWith("#")) {
                continue;
            }
            int keycode = mapKey(token);
            if (keycode < 0) {
                throw new UnknownKeyException(token);
            }
            parsed.add(keycode);
        }
        this.keycodes = parsed;
    }

    /**
     * Map a textual keystroke name to a libGDX keycode. Returns a negative
     * value if the token does not match any of the four supported names
     * (case-insensitive comparison is performed here).
     */
    private static int mapKey(String token) {
        if (token.equalsIgnoreCase("UP")) {
            return com.badlogic.gdx.Input.Keys.UP;
        }
        if (token.equalsIgnoreCase("DOWN")) {
            return com.badlogic.gdx.Input.Keys.DOWN;
        }
        if (token.equalsIgnoreCase("LEFT")) {
            return com.badlogic.gdx.Input.Keys.LEFT;
        }
        if (token.equalsIgnoreCase("RIGHT")) {
            return com.badlogic.gdx.Input.Keys.RIGHT;
        }
        return -1;
    }

    @Override
    public void setInputProcessor(InputProcessor processor) {
        // Capture the registered processor; the upstream MockInput ignores
        // the assignment, so we have to remember it ourselves in order to
        // forward scripted events through the normal InputProcessor contract.
        this.processor = processor;
    }

    @Override
    public InputProcessor getInputProcessor() {
        // Return the most recently registered processor so callers that
        // query Gdx.input.getInputProcessor() see the same instance that
        // receives our scripted events.
        return processor;
    }

    /**
     * Dispatch exactly one {@code keyDown} event to the registered
     * {@link InputProcessor}. Returns {@code true} if an event was
     * dispatched, or {@code false} if the script has been fully consumed
     * (or the file was empty).
     */
    public boolean processNext() {
        if (cursor >= keycodes.size()) {
            return false;
        }
        int keycode = keycodes.get(cursor++);
        if (processor != null) {
            processor.keyDown(keycode);
        }
        return true;
    }

    /** Returns {@code true} once every keystroke has been dispatched. */
    public boolean isExhausted() {
        return cursor >= keycodes.size();
    }

    /** Number of keystrokes remaining to be dispatched. */
    public int remaining() {
        return Math.max(0, keycodes.size() - cursor);
    }
}