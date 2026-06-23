package com.mygdx.game;

import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;
import java.util.List;

public class ReplayInput extends MockInput {
    private final List<Integer> keycodes;
    private int index = 0;
    private InputProcessor processor;

    public ReplayInput(List<Integer> keycodes) {
        this.keycodes = keycodes;
    }

    @Override
    public void setInputProcessor(InputProcessor processor) {
        this.processor = processor;
    }

    @Override
    public InputProcessor getInputProcessor() {
        return this.processor;
    }

    public void tick() {
        if (processor == null) {
            return;
        }
        if (index < keycodes.size()) {
            int keycode = keycodes.get(index);
            index++;
            processor.keyDown(keycode);
        }
    }

    public boolean isExhausted() {
        return index >= keycodes.size();
    }
}
