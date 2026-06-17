package com.game;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;

import java.util.concurrent.CountDownLatch;

/**
 * ApplicationListener that drives a 2D walker using scripted keyboard input.
 * Each render tick dispatches one keystroke from the replay file.
 * When all keystrokes have been consumed, prints the final position and exits.
 */
public class WalkerListener extends ApplicationAdapter {

    private final ScriptedInput scriptedInput;
    private final CountDownLatch latch;
    private WalkerInputProcessor processor;
    private boolean finished = false;

    public WalkerListener(ScriptedInput scriptedInput, CountDownLatch latch) {
        this.scriptedInput = scriptedInput;
        this.latch = latch;
    }

    @Override
    public void create() {
        processor = new WalkerInputProcessor();
        // Register the processor directly on ScriptedInput (ensures it works
        // even if Gdx.input hasn't been replaced yet due to timing)
        scriptedInput.setInputProcessor(processor);
        // Also register via Gdx.input to satisfy the InputProcessor contract
        Gdx.input.setInputProcessor(processor);
    }

    @Override
    public void render() {
        if (finished) {
            return;
        }

        if (!scriptedInput.tick()) {
            finished = true;
            System.out.println("Final position: (" + processor.getX() + ", " + processor.getY() + ")");
            Gdx.app.exit();
            latch.countDown();
        }
    }
}