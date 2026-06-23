package com.example.turnbased.core;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Headless input source that exposes exactly one scripted command per render tick.
 */
public final class ScriptedCommandInput extends MockInput {
    private final List<String> commands;
    private int nextCommandIndex;
    private String currentCommand;
    private int currentKeycode;

    public ScriptedCommandInput(List<String> commands) {
        this.commands = Collections.unmodifiableList(new ArrayList<>(commands));
        this.nextCommandIndex = 0;
        this.currentCommand = null;
        this.currentKeycode = -1;
    }

    /**
     * Advances to the next queued command for this render tick.
     *
     * @return true when a command is active for this tick, false when the script is exhausted
     */
    public boolean tick() {
        if (nextCommandIndex >= commands.size()) {
            currentCommand = null;
            currentKeycode = -1;
            return false;
        }

        currentCommand = commands.get(nextCommandIndex++);
        currentKeycode = keycodeFor(currentCommand);
        return true;
    }

    public String getCurrentCommand() {
        return currentCommand;
    }

    public boolean hasCurrentCommand() {
        return currentCommand != null;
    }

    public boolean isExhausted() {
        return nextCommandIndex >= commands.size() && currentCommand == null;
    }

    @Override
    public boolean isKeyPressed(int key) {
        return currentKeycode == key;
    }

    @Override
    public boolean isKeyJustPressed(int key) {
        return currentKeycode == key;
    }

    private static int keycodeFor(String command) {
        return switch (command) {
            case "N" -> Input.Keys.UP;
            case "S" -> Input.Keys.DOWN;
            case "E" -> Input.Keys.RIGHT;
            case "W" -> Input.Keys.LEFT;
            case "PICK" -> Input.Keys.SPACE;
            case "QUIT" -> Input.Keys.ESCAPE;
            default -> -1;
        };
    }
}
