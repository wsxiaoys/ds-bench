package com.combodetector.core;

import com.badlogic.gdx.Input.Keys;
import com.badlogic.gdx.InputAdapter;

/**
 * First processor in the multiplexer chain.
 *
 * <p>Toggles a paused state on {@code Keys.P} key-down and, while paused, swallows every other
 * key event so downstream processors (e.g. {@link ComboProcessor}) never see it.
 */
public class PauseProcessor extends InputAdapter {

    private boolean paused = false;

    public boolean isPaused() {
        return paused;
    }

    @Override
    public boolean keyDown(int keycode) {
        if (keycode == Keys.P) {
            paused = !paused;
            return true;
        }
        return paused;
    }

    @Override
    public boolean keyUp(int keycode) {
        if (keycode == Keys.P) {
            return true;
        }
        return paused;
    }
}
