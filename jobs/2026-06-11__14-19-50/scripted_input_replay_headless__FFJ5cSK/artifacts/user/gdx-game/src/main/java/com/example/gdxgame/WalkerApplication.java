package com.example.gdxgame;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputAdapter;
import com.badlogic.gdx.InputProcessor;

import java.util.concurrent.CountDownLatch;

final class WalkerApplication extends ApplicationAdapter {
    private final ScriptedMockInput scriptedInput;
    private final CountDownLatch finishedLatch;
    private final InputProcessor walkerProcessor = new WalkerInputProcessor();

    private int x;
    private int y;
    private boolean finished;

    WalkerApplication(ScriptedMockInput scriptedInput, CountDownLatch finishedLatch) {
        this.scriptedInput = scriptedInput;
        this.finishedLatch = finishedLatch;
        this.scriptedInput.setInputProcessor(walkerProcessor);
    }

    @Override
    public void create() {
        Gdx.input.setInputProcessor(walkerProcessor);
    }

    @Override
    public void render() {
        if (finished) {
            return;
        }

        if (!scriptedInput.dispatchNextTick()) {
            finished = true;
            System.out.printf("Final position: (%d, %d)%n", x, y);
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        finishedLatch.countDown();
    }

    InputProcessor walkerProcessor() {
        return walkerProcessor;
    }

    private final class WalkerInputProcessor extends InputAdapter {
        @Override
        public boolean keyDown(int keycode) {
            switch (keycode) {
                case Input.Keys.UP -> y++;
                case Input.Keys.DOWN -> y--;
                case Input.Keys.RIGHT -> x++;
                case Input.Keys.LEFT -> x--;
                default -> {
                    return false;
                }
            }
            return true;
        }
    }
}
