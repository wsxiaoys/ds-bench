package com.game;

import com.badlogic.gdx.Input;

/**
 * InputProcessor that tracks a 2D walker position based on arrow key inputs.
 */
public class WalkerInputProcessor implements com.badlogic.gdx.InputProcessor {

    private int x = 0;
    private int y = 0;

    public int getX() {
        return x;
    }

    public int getY() {
        return y;
    }

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
            default:
                return false;
        }
        return true;
    }

    @Override
    public boolean keyUp(int keycode) {
        return false;
    }

    @Override
    public boolean keyTyped(char character) {
        return false;
    }

    @Override
    public boolean touchDown(int screenX, int screenY, int pointer, int button) {
        return false;
    }

    @Override
    public boolean touchUp(int screenX, int screenY, int pointer, int button) {
        return false;
    }

    @Override
    public boolean touchDragged(int screenX, int screenY, int pointer) {
        return false;
    }

    @Override
    public boolean mouseMoved(int screenX, int screenY) {
        return false;
    }

    @Override
    public boolean touchCancelled(int screenX, int screenY, int pointer, int button) {
        return false;
    }

    @Override
    public boolean scrolled(float amountX, float amountY) {
        return false;
    }
}