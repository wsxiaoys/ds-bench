package com.example.gdxgame;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

import java.util.List;

/**
 * A MockInput subclass that replays a pre-parsed sequence of keycodes,
 * dispatching exactly one keyDown event per render tick.
 *
 * <p>The list of keycodes is supplied by the caller (already validated and
 * mapped from the input file).  Each call to {@link #tick()} dispatches the
 * next keycode to the registered {@link InputProcessor}.  When the sequence
 * is exhausted {@link #isFinished()} returns {@code true}.
 */
public class ScriptedInput extends MockInput {

    private InputProcessor inputProcessor;
    private final List<Integer> keycodes;
    private int index = 0;
    private volatile boolean finished = false;

    public ScriptedInput(List<Integer> keycodes) {
        this.keycodes = keycodes;
    }

    @Override
    public void setInputProcessor(InputProcessor processor) {
        this.inputProcessor = processor;
    }

    @Override
    public InputProcessor getInputProcessor() {
        return inputProcessor;
    }

    /**
     * Dispatch one keystroke from the sequence. Called once per render tick
     * by {@link WalkerGame#render()}.
     */
    public void tick() {
        if (finished) return;

        if (index >= keycodes.size()) {
            finished = true;
            return;
        }

        int keycode = keycodes.get(index++);
        if (inputProcessor != null) {
            inputProcessor.keyDown(keycode);
            inputProcessor.keyUp(keycode);
        }

        if (index >= keycodes.size()) {
            finished = true;
        }
    }

    public boolean isFinished() {
        return finished;
    }
}
