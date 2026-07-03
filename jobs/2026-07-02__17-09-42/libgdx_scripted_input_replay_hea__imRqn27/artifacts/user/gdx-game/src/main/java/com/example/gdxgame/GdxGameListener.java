package com.example.gdxgame;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicIntegerArray;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input.Keys;
import com.badlogic.gdx.InputAdapter;
import com.badlogic.gdx.InputProcessor;

/**
 * A minimal libGDX {@link ApplicationListener} that maintains a 2D integer
 * walker position starting at {@code (0, 0)} and feeds one scripted
 * keystroke through a registered {@link InputProcessor} per render tick.
 *
 * <p>When the {@link ScriptedInput} is exhausted the listener prints the
 * final walker position to stdout, releases the supplied latch so the
 * launcher can return, and asks libGDX to exit cleanly.</p>
 */
public class GdxGameListener implements ApplicationListener {

    private final ScriptedInput scriptedInput;
    private final CountDownLatch finished;
    /** Mutable holder for the final (x, y) position visible to the launcher. */
    private final AtomicIntegerArray finalPosition;

    private int x = 0;
    private int y = 0;
    private boolean printed = false;

    public GdxGameListener(ScriptedInput scriptedInput,
                           CountDownLatch finished,
                           AtomicIntegerArray finalPosition) {
        this.scriptedInput = scriptedInput;
        this.finished = finished;
        this.finalPosition = finalPosition;
    }

    @Override
    public void create() {
        Gdx.input.setInputProcessor(new WalkerInputProcessor());
    }

    @Override
    public void render() {
        boolean dispatched = scriptedInput.processNext();
        if (!dispatched && !printed) {
            printed = true;
            finalPosition.set(0, x);
            finalPosition.set(1, y);
            System.out.println("Final position: (" + x + ", " + y + ")");
            System.out.flush();
            finished.countDown();
            Gdx.app.exit();
        }
    }

    @Override
    public void resize(int width, int height) {
        // No-op: headless backend has no real surface to resize.
    }

    @Override
    public void pause() {
        // No-op.
    }

    @Override
    public void resume() {
        // No-op.
    }

    @Override
    public void dispose() {
        // No-op: no native resources to release.
    }

    /**
     * Walks the 2D position one step per {@code keyDown} callback. All
     * other callbacks are inherited from {@link InputAdapter} (no-ops).
     */
    private final class WalkerInputProcessor extends InputAdapter {
        @Override
        public boolean keyDown(int keycode) {
            switch (keycode) {
                case Keys.UP:
                    y++;
                    return true;
                case Keys.DOWN:
                    y--;
                    return true;
                case Keys.LEFT:
                    x--;
                    return true;
                case Keys.RIGHT:
                    x++;
                    return true;
                default:
                    return false;
            }
        }
    }
}