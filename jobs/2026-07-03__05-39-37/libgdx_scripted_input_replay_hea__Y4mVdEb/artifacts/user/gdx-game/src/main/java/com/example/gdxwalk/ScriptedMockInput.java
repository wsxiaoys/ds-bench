package com.example.gdxwalk;

import com.badlogic.gdx.Input.Keys;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * A {@link MockInput} subclass that reads a keystroke replay file and re-dispatches
 * exactly one {@link InputProcessor#keyDown(int)} event per render tick.
 *
 * <p>The file is parsed eagerly in the constructor so that unknown tokens are reported
 * before the headless main loop is started (and before any "Final position:" line is
 * printed).</p>
 */
public class ScriptedMockInput extends MockInput {

    /** Thrown when the replay file contains a token that is not a recognised keystroke. */
    public static final class UnknownKeyException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        final String token;

        UnknownKeyException(String token) {
            super("unknown key " + token);
            this.token = token;
        }
    }

    private static final Map<String, Integer> NAME_TO_KEYCODE = new HashMap<>();
    static {
        NAME_TO_KEYCODE.put("UP", Keys.UP);
        NAME_TO_KEYCODE.put("DOWN", Keys.DOWN);
        NAME_TO_KEYCODE.put("LEFT", Keys.LEFT);
        NAME_TO_KEYCODE.put("RIGHT", Keys.RIGHT);
    }

    private final Deque<Integer> keycodes = new ArrayDeque<>();
    private InputProcessor processor;

    public ScriptedMockInput(Path inputPath) throws IOException {
        List<String> lines = Files.readAllLines(inputPath, StandardCharsets.UTF_8);
        for (String raw : lines) {
            String token = raw.trim();
            if (token.isEmpty()) {
                continue; // blank line: skip, consumes no tick
            }
            if (token.startsWith("#")) {
                continue; // comment: skip, consumes no tick
            }
            Integer code = NAME_TO_KEYCODE.get(token.toUpperCase());
            if (code == null) {
                throw new UnknownKeyException(token);
            }
            keycodes.add(code);
        }
    }

    /** @return {@code true} if there are still keystrokes waiting to be dispatched. */
    public boolean hasNext() {
        return !keycodes.isEmpty();
    }

    /**
     * Dispatches the next keystroke to the registered {@link InputProcessor}.
     *
     * @return {@code true} if a {@code keyDown} event was dispatched, {@code false} if the
     *         replay is exhausted (or no processor has been registered yet).
     */
    public boolean dispatchNext() {
        if (keycodes.isEmpty() || processor == null) {
            return false;
        }
        int keycode = keycodes.poll();
        processor.keyDown(keycode);
        return true;
    }

    @Override
    public void setInputProcessor(InputProcessor processor) {
        this.processor = processor;
    }

    @Override
    public InputProcessor getInputProcessor() {
        return processor;
    }
}