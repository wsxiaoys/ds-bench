package com.example.gdxgame;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputAdapter;

/**
 * A libGDX ApplicationAdapter that maintains a 2D integer walker position.
 *
 * <p>Position updates are driven entirely through the {@link com.badlogic.gdx.InputProcessor}
 * registered via {@code Gdx.input.setInputProcessor(...)}. Each render tick
 * the {@link ScriptedInput} layer dispatches one keyDown event which is handled
 * here to move the walker.
 */
public class WalkerGame extends ApplicationAdapter {

    private final ScriptedInput scriptedInput;

    private int x = 0;
    private int y = 0;
    private boolean done = false;

    public WalkerGame(ScriptedInput scriptedInput) {
        this.scriptedInput = scriptedInput;
    }

    @Override
    public void create() {
        // Install ScriptedInput as the active Gdx.input so that the standard
        // setInputProcessor call below is routed to our subclass.
        Gdx.input = scriptedInput;

        // Register the movement processor via the canonical libGDX API.
        // ScriptedInput.setInputProcessor stores it and dispatches keyDown
        // events to it each tick.
        Gdx.input.setInputProcessor(new InputAdapter() {
            @Override
            public boolean keyDown(int keycode) {
                switch (keycode) {
                    case Input.Keys.UP:    y += 1; break;
                    case Input.Keys.DOWN:  y -= 1; break;
                    case Input.Keys.RIGHT: x += 1; break;
                    case Input.Keys.LEFT:  x -= 1; break;
                    default: break;
                }
                return true;
            }
        });
    }

    @Override
    public void render() {
        if (done) {
            return;
        }
        if (scriptedInput.isFinished()) {
            // All keystrokes consumed -- print result and shut down.
            done = true;
            System.out.println("Final position: (" + x + ", " + y + ")");
            Gdx.app.exit();
            return;
        }
        scriptedInput.tick();
    }

    @Override
    public void dispose() {
        // Nothing to dispose -- no OpenGL resources are used.
    }
}
