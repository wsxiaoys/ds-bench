package com.gdxgame;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputAdapter;

/**
 * A headless libGDX ApplicationListener that simulates a 2D grid walker.
 *
 * Position starts at (0, 0). The game registers an InputProcessor that updates
 * position on keyDown events. Each render tick, one keystroke is dispatched
 * from the ScriptedInput. When the script is exhausted, the application exits.
 */
public class WalkerGame implements ApplicationListener {

    private int x = 0;
    private int y = 0;
    private final ScriptedInput scriptedInput;
    private boolean finished = false;
    private boolean initialized = false;

    public WalkerGame(ScriptedInput scriptedInput) {
        this.scriptedInput = scriptedInput;
    }

    @Override
    public void create() {
        // InputProcessor registration is deferred to the first render() call
        // because the launcher needs to overwrite Gdx.input with ScriptedInput
        // after HeadlessApplication construction.
    }

    @Override
    public void render() {
        if (!initialized) {
            initialized = true;
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
                        default:
                            break;
                    }
                    return true;
                }
            });
        }

        if (finished) {
            return;
        }
        if (scriptedInput.isExhausted()) {
            finished = true;
            System.out.println("Final position: (" + x + ", " + y + ")");
            Gdx.app.exit();
            return;
        }
        scriptedInput.dispatchNextKey();
    }

    @Override
    public void resize(int width, int height) {
    }

    @Override
    public void pause() {
    }

    @Override
    public void resume() {
    }

    @Override
    public void dispose() {
    }
}
