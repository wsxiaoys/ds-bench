package com.example.turnbased.core;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * MockInput subclass that exposes a scripted sequence of commands to the
 * game. Each call to {@link #tick()} advances the cursor by one position and
 * updates the "current command" state. While the cursor is inside the list,
 * {@link #isKeyJustPressed(int)} and {@link #isKeyPressed(int)} return true
 * for the libGDX keycode mapped from the current command. Once the cursor
 * walks past the end, both methods always return false.
 */
public class ScriptedMockInput extends MockInput {

    private List<String> commands = Collections.emptyList();
    private int cursor = -1;
    private String currentRaw;
    private int currentKey = KEY_NONE;

    /** Sentinel value for "no active key for this tick". */
    private static final int KEY_NONE = -1;

    public ScriptedMockInput() {
        super();
    }

    /** Replaces the queued commands. Safe to call before {@link #tick()}. */
    public synchronized void setCommands(List<String> commands) {
        this.commands = new ArrayList<>(commands);
        this.cursor = -1;
        this.currentRaw = null;
        this.currentKey = KEY_NONE;
    }

    /**
     * Advance to the next command in the script. When the cursor moves past
     * the last entry, the input reports no key activity for subsequent ticks.
     */
    public synchronized void tick() {
        int next = cursor + 1;
        if (next < commands.size()) {
            cursor = next;
            currentRaw = commands.get(cursor);
            currentKey = mapToKey(currentRaw);
        } else {
            currentRaw = null;
            currentKey = KEY_NONE;
        }
    }

    /** True when a command is still available for this tick. */
    public synchronized boolean hasCommand() {
        return currentRaw != null;
    }

    /** The raw command text for the current tick (null when exhausted). */
    public synchronized String currentCommand() {
        return currentRaw;
    }

    @Override
    public synchronized boolean isKeyJustPressed(int keycode) {
        return currentKey != KEY_NONE && currentKey == keycode;
    }

    @Override
    public synchronized boolean isKeyPressed(int keycode) {
        return currentKey != KEY_NONE && currentKey == keycode;
    }

    private static int mapToKey(String cmd) {
        if (cmd == null) {
            return KEY_NONE;
        }
        switch (cmd) {
            case "N":    return Input.Keys.UP;
            case "S":    return Input.Keys.DOWN;
            case "E":    return Input.Keys.RIGHT;
            case "W":    return Input.Keys.LEFT;
            case "PICK": return Input.Keys.SPACE;
            case "QUIT": return Input.Keys.ESCAPE;
            default:     return KEY_NONE;
        }
    }
}