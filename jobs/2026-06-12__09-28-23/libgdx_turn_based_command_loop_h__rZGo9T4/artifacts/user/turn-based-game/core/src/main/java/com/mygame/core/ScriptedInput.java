package com.mygame.core;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;
import java.util.Queue;
import java.util.LinkedList;

public class ScriptedInput extends MockInput {
    private final Queue<String> commands = new LinkedList<>();
    private String currentCommand = null;
    private int currentKey = -1;

    public void addCommand(String cmd) {
        commands.add(cmd);
    }

    public boolean hasMoreCommands() {
        return !commands.isEmpty();
    }

    public String getCurrentCommand() {
        return currentCommand;
    }

    public boolean tick() {
        if (commands.isEmpty()) {
            currentCommand = null;
            currentKey = -1;
            return false;
        }
        currentCommand = commands.poll();
        currentKey = mapCommandToKey(currentCommand);
        return true;
    }

    private int mapCommandToKey(String cmd) {
        if (cmd == null) return -1;
        switch (cmd) {
            case "N": return Input.Keys.UP;
            case "S": return Input.Keys.DOWN;
            case "E": return Input.Keys.RIGHT;
            case "W": return Input.Keys.LEFT;
            case "PICK": return Input.Keys.SPACE;
            case "QUIT": return Input.Keys.ESCAPE;
            default: return -1;
        }
    }

    @Override
    public boolean isKeyPressed(int key) {
        return currentKey != -1 && currentKey == key;
    }

    @Override
    public boolean isKeyJustPressed(int key) {
        return currentKey != -1 && currentKey == key;
    }
}
