package com.example;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        String inputPath = null;
        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputPath = arg.substring("--input=".length());
            }
        }

        if (inputPath == null) {
            System.err.println("Usage: --input=<path>");
            System.exit(1);
        }

        List<String> lines;
        try {
            lines = Files.readAllLines(Paths.get(inputPath));
        } catch (IOException e) {
            System.err.println("Error reading file: " + e.getMessage());
            System.exit(1);
            return;
        }

        List<Integer> keys = new ArrayList<>();
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            String upper = trimmed.toUpperCase();
            switch (upper) {
                case "UP":
                    keys.add(Input.Keys.UP);
                    break;
                case "DOWN":
                    keys.add(Input.Keys.DOWN);
                    break;
                case "LEFT":
                    keys.add(Input.Keys.LEFT);
                    break;
                case "RIGHT":
                    keys.add(Input.Keys.RIGHT);
                    break;
                default:
                    System.err.println("Error: unknown key " + trimmed);
                    System.exit(1);
                    return;
            }
        }

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60;

        ScriptedInput input = new ScriptedInput(keys);
        final WalkerGame game = new WalkerGame(input);
        new HeadlessApplication(game, config);

        // Block main thread until simulation is done
        while (!game.isFinished()) {
            try {
                Thread.sleep(10);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        
        System.out.println("Final position: (" + game.getX() + ", " + game.getY() + ")");
        System.exit(0);
    }
}

class WalkerGame extends ApplicationAdapter {
    private int x = 0;
    private int y = 0;
    private volatile boolean finished = false;
    private ScriptedInput scriptedInput;

    public WalkerGame(ScriptedInput scriptedInput) {
        this.scriptedInput = scriptedInput;
    }

    public boolean isFinished() {
        return finished;
    }

    public int getX() { return x; }
    public int getY() { return y; }

    @Override
    public void create() {
        Gdx.input = scriptedInput;
        Gdx.input.setInputProcessor(new InputProcessor() {
            @Override public boolean keyDown(int keycode) {
                if (keycode == Input.Keys.UP) y++;
                else if (keycode == Input.Keys.DOWN) y--;
                else if (keycode == Input.Keys.RIGHT) x++;
                else if (keycode == Input.Keys.LEFT) x--;
                return true;
            }
            @Override public boolean keyUp(int keycode) { return false; }
            @Override public boolean keyTyped(char character) { return false; }
            @Override public boolean touchDown(int screenX, int screenY, int pointer, int button) { return false; }
            @Override public boolean touchUp(int screenX, int screenY, int pointer, int button) { return false; }
            @Override public boolean touchCancelled(int screenX, int screenY, int pointer, int button) { return false; }
            @Override public boolean touchDragged(int screenX, int screenY, int pointer) { return false; }
            @Override public boolean mouseMoved(int screenX, int screenY) { return false; }
            @Override public boolean scrolled(float amountX, float amountY) { return false; }
        });
    }

    @Override
    public void render() {
        if (!scriptedInput.tick()) {
            Gdx.app.exit();
            finished = true;
        }
    }
}

class ScriptedInput extends MockInput {
    private List<Integer> keys;
    private int currentIndex = 0;
    private InputProcessor processor;

    public ScriptedInput(List<Integer> keys) {
        this.keys = keys;
    }

    @Override
    public void setInputProcessor(InputProcessor processor) {
        this.processor = processor;
    }

    @Override
    public InputProcessor getInputProcessor() {
        return processor;
    }
    
    /** Returns true if there are still keys to process, false if finished. */
    public boolean tick() {
        if (currentIndex < keys.size()) {
            if (processor != null) {
                processor.keyDown(keys.get(currentIndex));
            }
            currentIndex++;
            return true;
        } else {
            return false;
        }
    }
}
