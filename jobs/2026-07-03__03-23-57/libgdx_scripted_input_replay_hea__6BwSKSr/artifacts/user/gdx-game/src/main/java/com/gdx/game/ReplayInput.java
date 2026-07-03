package com.gdx.game;

import com.badlogic.gdx.backends.headless.mock.input.MockInput;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.Gdx;
import java.util.List;

public class ReplayInput extends MockInput {
    private final List<Integer> keycodes;
    private int currentIndex = 0;
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

    public void update() {
        if (currentIndex < keycodes.size()) {
            int keycode = keycodes.get(currentIndex);
            currentIndex++;
            if (processor != null) {
                processor.keyDown(keycode);
            }
        } else {
            // After the file is exhausted, the application must call Gdx.app.exit() so the headless main loop terminates cleanly.
            Gdx.app.exit();
        }
    }
}
