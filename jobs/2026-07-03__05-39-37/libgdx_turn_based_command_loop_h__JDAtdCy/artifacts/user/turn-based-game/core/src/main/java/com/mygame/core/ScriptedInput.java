package com.mygame.core;

import java.util.ArrayList;
import java.util.List;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

/**
 * A scripted {@link MockInput} that replays a queue of commands, one per tick.
 *
 * <p>The game loop calls {@link #tick()} at the start of each render frame to
 * advance to the next command. The current command is then exposed to the
 * {@link com.badlogic.gdx.ApplicationListener} through the standard
 * {@link #isKeyJustPressed(int)} / {@link #isKeyPressed(int)} contract: the
 * method returns {@code true} when the supplied keycode matches the keycode
 * mapped from the current command.</p>
 *
 * <p>Command -> keycode mapping (case-sensitive):</p>
 * <ul>
 *   <li>{@code N}  -> {@link Input.Keys#UP}</li>
 *   <li>{@code S}  -> {@link Input.Keys#DOWN}</li>
 *   <li>{@code E}  -> {@link Input.Keys#RIGHT}</li>
 *   <li>{@code W}  -> {@link Input.Keys#LEFT}</li>
 *   <li>{@code PICK} -> {@link Input.Keys#SPACE}</li>
 *   <li>{@code QUIT} -> {@link Input.Keys#ESCAPE}</li>
 *   <li>anything else -> no keycode active for this tick</li>
 * </ul>
 */
public class ScriptedInput extends MockInput {

    private final List<String> commands = new ArrayList<String>();
    private int currentIndex = -1;

    /** Replaces the command queue. */
    public void setCommands(List<String> commands) {
        this.commands.clear();
        if (commands != null) {
            this.commands.addAll(commands);
        }
        this.currentIndex = -1;
    }

    /** Number of queued commands. */
    public int size() {
        return commands.size();
    }

    /**
     * Advances to the next command. Called once at the start of each render
     * tick, before the listener reads {@link #isKeyJustPressed(int)}.
     */
    public void tick() {
        currentIndex++;
    }

    /** @return {@code true} when the command queue has been fully consumed. */
    public boolean isExhausted() {
        return currentIndex >= commands.size();
    }

    /** @return the raw (trimmed) command string for the current tick. */
    public String currentRaw() {
        return commands.get(currentIndex);
    }

    /** @return the keycode mapped from the current command, or {@code -1} for unknown commands / when exhausted. */
    public int currentKeycode() {
        if (currentIndex < 0 || currentIndex >= commands.size()) {
            return -1;
        }
        return mapKeycode(commands.get(currentIndex));
    }

    @Override
    public boolean isKeyJustPressed(int key) {
        return currentKeycode() == key;
    }

    @Override
    public boolean isKeyPressed(int key) {
        return currentKeycode() == key;
    }

    private static int mapKeycode(String command) {
        switch (command) {
            case "N":
                return Input.Keys.UP;
            case "S":
                return Input.Keys.DOWN;
            case "E":
                return Input.Keys.RIGHT;
            case "W":
                return Input.Keys.LEFT;
            case "PICK":
                return Input.Keys.SPACE;
            case "QUIT":
                return Input.Keys.ESCAPE;
            default:
                return -1;
        }
    }
}