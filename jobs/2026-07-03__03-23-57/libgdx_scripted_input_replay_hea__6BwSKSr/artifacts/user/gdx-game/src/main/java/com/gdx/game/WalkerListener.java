package com.gdx.game;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputAdapter;

public class WalkerListener extends ApplicationAdapter {
    private int x = 0;
    private int y = 0;
    private final ReplayInput replayInput;

    public WalkerListener(ReplayInput replayInput) {
        this.replayInput = replayInput;
    }

    @Override
    public void create() {
        Gdx.input = replayInput;
        Gdx.input.setInputProcessor(new InputAdapter() {
            @Override
            public boolean keyDown(int keycode) {
                if (keycode == Input.Keys.UP) {
                    y += 1;
                } else if (keycode == Input.Keys.DOWN) {
                    y -= 1;
                } else if (keycode == Input.Keys.LEFT) {
                    x -= 1;
                } else if (keycode == Input.Keys.RIGHT) {
                    x += 1;
                }
                return true;
            }
        });
    }

    @Override
    public void render() {
        replayInput.update();
    }

    public int getX() {
        return x;
    }

    public int getY() {
        return y;
    }
}
