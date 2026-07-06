package com.mygame.core;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;
import java.util.List;
import java.util.ArrayList;

public class GameInput extends MockInput {
    private final List<String> commands;
    private int currentIndex = -1;
    private String currentCommand = null;
    private int currentKey = -1;

    public GameInput(List<String> commands) {
        this.commands = new ArrayList<>(commands);
    }

    public boolean hasNext() {
        return currentIndex + 1 < commands.size();
    }

    public void tick() {
        currentIndex++;
        if (currentIndex < commands.size()) {
            currentCommand = commands.get(currentIndex);
            currentKey = commandToKey(currentCommand);
        } else {
            currentCommand = null;
            currentKey = -1;
        }
    }

    public String getCurrentCommand() {
        return currentCommand;
    }

    public boolean isExhausted() {
        return currentIndex >= commands.size() - 1;
    }

    private int commandToKey(String cmd) {
        if (cmd == null) return -1;
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
        return currentKey != -1 && key == currentKey;
    }

    @Override
    public boolean isKeyJustPressed(int key) {
        return currentKey != -1 && key == currentKey;
    }
}
