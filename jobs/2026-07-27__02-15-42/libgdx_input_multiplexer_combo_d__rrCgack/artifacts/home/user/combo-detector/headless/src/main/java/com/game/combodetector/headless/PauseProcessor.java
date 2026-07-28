package com.game.combodetector.headless;

import com.badlogic.gdx.InputAdapter;
import com.badlogic.gdx.Input.Keys;

public class PauseProcessor extends InputAdapter {
    private boolean paused = false;

    public boolean isPaused() {
        return paused;
    }

    @Override
    public boolean keyDown(int keycode) {
        if (keycode == Keys.P) { // PAUSE
            paused = !paused;
            return true;
        }
        if (paused) {
            return true;
        }
        return false;
    }

    @Override
    public boolean keyUp(int keycode) {
        if (keycode == Keys.P) { // PAUSE
            return true;
        }
        if (paused) {
            return true;
        }
        return false;
    }
}
