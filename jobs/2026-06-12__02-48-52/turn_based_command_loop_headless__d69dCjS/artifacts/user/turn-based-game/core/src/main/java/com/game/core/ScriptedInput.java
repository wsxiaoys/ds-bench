package com.game.core;

import com.badlogic.gdx.Input.Keys;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

import java.util.List;

public class ScriptedInput extends MockInput {
    private final List<String> commands;
    private int currentIndex = 0;
    private int currentKey = -1;
    private String currentRawCommand = null;

    public ScriptedInput(List<String> commands) {
        this.commands = commands;
    }

    public void tick() {
        if (currentIndex < commands.size()) {
            currentRawCommand = commands.get(currentIndex).trim();
            currentIndex++;
            currentKey = mapCommandToKey(currentRawCommand);
        } else {
            currentRawCommand = null;
            currentKey = -1;
        }
    }

    public String getCurrentRawCommand() {
        return currentRawCommand;
    }

    public boolean hasMoreCommands() {
        return currentRawCommand != null || currentIndex < commands.size();
    }

    public void consumeCommand() {
        currentRawCommand = null;
        currentKey = -1;
    }

    private int mapCommandToKey(String cmd) {
        switch (cmd) {
            case "N": return Keys.UP;
            case "S": return Keys.DOWN;
            case "E": return Keys.RIGHT;
            case "W": return Keys.LEFT;
            case "PICK": return Keys.SPACE;
            case "QUIT": return Keys.ESCAPE;
            default: return -1;
        }
    }

    @Override
    public boolean isKeyPressed(int key) {
        return key == currentKey && key != -1;
    }

    @Override
    public boolean isKeyJustPressed(int key) {
        return key == currentKey && key != -1;
    }
}
