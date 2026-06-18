package com.dungeon.core;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

import java.util.ArrayList;
import java.util.List;

/**
 * A MockInput subclass that reads commands from a pre-loaded list.
 * Each tick, the next command is consumed and exposed via isKeyJustPressed/isKeyPressed.
 * Unknown commands (not mapping to any keycode) set no key active this tick.
 */
public class ScriptedMockInput extends MockInput {

    private final List<String> commands;
    private int commandIndex = 0;

    /** The keycode active for the current tick, or -1 if the current command is unknown. */
    private int currentKey = -1;

    /** Whether the current key has been consumed by isKeyJustPressed this tick. */
    private boolean justPressedConsumed = false;

    public ScriptedMockInput(List<String> commands) {
        this.commands = new ArrayList<>(commands);
    }

    /**
     * Advance to the next command in the queue. Call once per tick before polling keys.
     * @return the raw command string for this tick, or null if no more commands.
     */
    public String tick() {
        // Reset state from previous tick
        currentKey = -1;
        justPressedConsumed = false;

        if (commandIndex >= commands.size()) {
            return null;
        }

        String cmd = commands.get(commandIndex);
        commandIndex++;
        currentKey = mapCommandToKey(cmd);
        return cmd;
    }

    /**
     * @return true if there are still commands remaining in the queue.
     */
    public boolean hasMoreCommands() {
        return commandIndex < commands.size();
    }

    /**
     * Map a command string to its libGDX keycode.
     */
    private int mapCommandToKey(String cmd) {
        switch (cmd) {
            case "N": return Input.Keys.UP;
            case "S": return Input.Keys.DOWN;
            case "E": return Input.Keys.RIGHT;
            case "W": return Input.Keys.LEFT;
            case "PICK": return Input.Keys.SPACE;
            case "QUIT": return Input.Keys.ESCAPE;
            default: return -1; // unknown command
        }
    }

    @Override
    public boolean isKeyPressed(int key) {
        return currentKey == key;
    }

    @Override
    public boolean isKeyJustPressed(int key) {
        if (currentKey == key && !justPressedConsumed) {
            justPressedConsumed = true;
            return true;
        }
        return false;
    }
}
