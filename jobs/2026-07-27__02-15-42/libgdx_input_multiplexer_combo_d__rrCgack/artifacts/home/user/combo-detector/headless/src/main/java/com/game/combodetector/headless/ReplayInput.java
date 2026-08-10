package com.game.combodetector.headless;

import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class ReplayInput extends MockInput {
    private InputProcessor processor;
    private final List<String> lines = new ArrayList<>();
    private int currentTick = 0;
    private final Set<Integer> pressedKeys = new HashSet<>();

    public ReplayInput(String inputFilePath) throws IOException {
        try (BufferedReader reader = new BufferedReader(new FileReader(inputFilePath))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lines.add(line);
            }
        }
    }

    @Override
    public void setInputProcessor(InputProcessor processor) {
        this.processor = processor;
    }

    @Override
    public InputProcessor getInputProcessor() {
        return this.processor;
    }

    public boolean hasMoreTicks() {
        return currentTick < lines.size();
    }

    public int getCurrentTick() {
        return currentTick;
    }

    public void tick() {
        if (!hasMoreTicks()) {
            return;
        }
        String line = lines.get(currentTick);
        String trimmed = line.trim();
        if (!trimmed.isEmpty()) {
            String[] tokens = trimmed.split("\\s+");
            for (String token : tokens) {
                if (token.isEmpty()) continue;
                char sign = token.charAt(0);
                String keyName = token.substring(1);
                int keycode = KeyMapper.getKeyCode(keyName);
                if (keycode != -1) {
                    if (sign == '+') {
                        pressedKeys.add(keycode);
                        if (processor != null) {
                            processor.keyDown(keycode);
                        }
                    } else if (sign == '-') {
                        pressedKeys.remove(keycode);
                        if (processor != null) {
                            processor.keyUp(keycode);
                        }
                    }
                }
            }
        }
        currentTick++;
    }

    @Override
    public boolean isKeyPressed(int key) {
        return pressedKeys.contains(key);
    }
}
