package com.mygdx.game;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputAdapter;

public class WalkerGame extends ApplicationAdapter {
    private final ReplayInput replayInput;
    private int x = 0;
    private int y = 0;
    private volatile boolean finished = false;

    public WalkerGame(ReplayInput replayInput) {
        this.replayInput = replayInput;
    }

    public int getX() {
        return x;
    }

    public int getY() {
        return y;
    }

    public boolean isFinished() {
        return finished;
    }

    @Override
    public void create() {
        Gdx.input = replayInput;
        Gdx.input.setInputProcessor(new InputAdapter() {
            @Override
            public boolean keyDown(int keycode) {
                switch (keycode) {
                    case Input.Keys.UP:
                        y++;
                        break;
                    case Input.Keys.DOWN:
                        y--;
                        break;
                    case Input.Keys.LEFT:
                        x--;
                        break;
                    case Input.Keys.RIGHT:
                        x++;
                        break;
                }
                return true;
            }
        });
    }

    @Override
    public void render() {
        if (replayInput.isExhausted()) {
            Gdx.app.exit();
        } else {
            replayInput.tick();
        }
    }

    @Override
    public void dispose() {
        finished = true;
    }
}
