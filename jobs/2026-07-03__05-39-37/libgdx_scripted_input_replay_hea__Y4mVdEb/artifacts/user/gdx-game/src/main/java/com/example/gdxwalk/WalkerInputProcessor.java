package com.example.gdxwalk;

import com.badlogic.gdx.Input.Keys;
import com.badlogic.gdx.InputAdapter;

/**
 * The {@link com.badlogic.gdx.InputProcessor} that owns the walker's movement logic.
 *
 * <p>Position updates happen exclusively inside {@link #keyDown(int)}, satisfying the
 * requirement that movement is driven through the libGDX {@code InputProcessor} contract.
 * The processor mutates the {@link WalkerListener}'s position fields directly so that the
 * simulation thread and the launcher thread share a single source of truth.</p>
 */
public class WalkerInputProcessor extends InputAdapter {

    private final WalkerListener listener;

    WalkerInputProcessor(WalkerListener listener) {
        this.listener = listener;
    }

    @Override
    public boolean keyDown(int keycode) {
        switch (keycode) {
            case Keys.UP:
                listener.y++;
                break;
            case Keys.DOWN:
                listener.y--;
                break;
            case Keys.RIGHT:
                listener.x++;
                break;
            case Keys.LEFT:
                listener.x--;
                break;
            default:
                return false;
        }
        return true;
    }
}