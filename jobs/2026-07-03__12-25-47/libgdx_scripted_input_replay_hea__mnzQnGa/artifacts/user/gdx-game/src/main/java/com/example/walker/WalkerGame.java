package com.example.walker;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputProcessor;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

public class WalkerGame extends ApplicationAdapter implements InputProcessor {
    private int x = 0;
    private int y = 0;
    private ScriptedInput scriptedInput;
    private final AtomicReference<Thread> mainLoopThread = new AtomicReference<>();
    private final AtomicBoolean exitRequested = new AtomicBoolean(false);

    public void setScriptedInput(ScriptedInput scriptedInput) {
        this.scriptedInput = scriptedInput;
    }

    public int getX() { return x; }
    public int getY() { return y; }

    public Thread getMainLoopThread() {
        return mainLoopThread.get();
    }

    @Override
    public void create() {
        mainLoopThread.set(Thread.currentThread());
        // The InputProcessor must be registered with the (possibly replaced) Gdx.input
        Gdx.input.setInputProcessor(this);
        // If the script is empty (no keystrokes to dispatch), exit on the very first tick
        if (scriptedInput != null && scriptedInput.isExhausted()) {
            requestExit();
        }
    }

    @Override
    public void render() {
        if (scriptedInput == null) {
            return;
        }
        if (!scriptedInput.isExhausted()) {
            scriptedInput.dispatchNext();
        }
        if (scriptedInput.isExhausted()) {
            requestExit();
        }
    }

    private void requestExit() {
        if (exitRequested.compareAndSet(false, true)) {
            Gdx.app.exit();
        }
    }

    @Override
    public boolean keyDown(int keycode) {
        switch (keycode) {
            case Input.Keys.UP:
                y += 1;
                return true;
            case Input.Keys.DOWN:
                y -= 1;
                return true;
            case Input.Keys.LEFT:
                x -= 1;
                return true;
            case Input.Keys.RIGHT:
                x += 1;
                return true;
        }
        return false;
    }

    @Override public boolean keyUp(int keycode) { return false; }
    @Override public boolean keyTyped(char character) { return false; }
    @Override public boolean touchDown(int screenX, int screenY, int pointer, int button) { return false; }
    @Override public boolean touchUp(int screenX, int screenY, int pointer, int button) { return false; }
    @Override public boolean touchDragged(int screenX, int screenY, int pointer) { return false; }
    @Override public boolean mouseMoved(int screenX, int screenY) { return false; }
    @Override public boolean scrolled(float amountX, float amountY) { return false; }
    @Override public boolean touchCancelled(int screenX, int screenY, int pointer, int button) { return false; }
}
