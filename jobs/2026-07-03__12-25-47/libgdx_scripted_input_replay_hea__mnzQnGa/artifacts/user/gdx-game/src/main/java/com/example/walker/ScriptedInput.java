package com.example.walker;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

public class ScriptedInput extends MockInput {
    private final List<String> keys = new ArrayList<>();
    private int index = 0;
    private InputProcessor processor;

    public ScriptedInput(String path) throws IOException {
        List<String> lines = Files.readAllLines(Paths.get(path), StandardCharsets.UTF_8);
        for (String raw : lines) {
            String line = raw.trim();
            if (line.isEmpty()) continue;
            if (line.startsWith("#")) continue;
            String upper = line.toUpperCase();
            switch (upper) {
                case "UP":
                case "DOWN":
                case "LEFT":
                case "RIGHT":
                    keys.add(upper);
                    break;
                default:
                    throw new IllegalArgumentException("unknown key " + line);
            }
        }
    }

    public boolean isExhausted() {
        return index >= keys.size();
    }

    public int size() {
        return keys.size();
    }

    public int position() {
        return index;
    }

    @Override
    public void setInputProcessor(InputProcessor processor) {
        this.processor = processor;
    }

    @Override
    public InputProcessor getInputProcessor() {
        return processor;
    }

    public boolean dispatchNext() {
        if (index >= keys.size()) {
            return false;
        }
        String key = keys.get(index++);
        int keycode;
        switch (key) {
            case "UP": keycode = Input.Keys.UP; break;
            case "DOWN": keycode = Input.Keys.DOWN; break;
            case "LEFT": keycode = Input.Keys.LEFT; break;
            case "RIGHT": keycode = Input.Keys.RIGHT; break;
            default:
                throw new IllegalStateException("unreachable: " + key);
        }
        if (processor != null) {
            processor.keyDown(keycode);
        }
        return true;
    }
}
