package com.game.core;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input.Keys;
import com.badlogic.gdx.files.FileHandle;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;

public class GameListener implements ApplicationListener {
    private final String mapPath;
    private final String commandsPath;
    private final String transcriptPath;

    private int width, height;
    private int playerX, playerY;
    private List<Item> items = new ArrayList<>();
    private List<String> inventory = new ArrayList<>();
    
    private ScriptedInput scriptedInput;
    private int turnCount = 0;
    private StringBuilder transcriptBuilder = new StringBuilder();
    private boolean finished = false;
    private final CountDownLatch latch = new CountDownLatch(1);

    public CountDownLatch getLatch() {
        return latch;
    }

    private static class Item {
        int x, y;
        String name;
        Item(int x, int y, String name) {
            this.x = x; this.y = y; this.name = name;
        }
    }

    public GameListener(String mapPath, String commandsPath, String transcriptPath) {
        this.mapPath = mapPath;
        this.commandsPath = commandsPath;
        this.transcriptPath = transcriptPath;
    }

    @Override
    public void create() {
        // Read map
        FileHandle mapFile = Gdx.files.absolute(mapPath);
        String[] lines = mapFile.readString("UTF-8").split("\\r?\\n");
        List<String> validTokens = new ArrayList<>();
        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty() || line.startsWith("#")) continue;
            String[] tokens = line.split("\\s+");
            for (String t : tokens) {
                if (!t.isEmpty()) validTokens.add(t);
            }
        }

        int tokenIdx = 0;
        width = Integer.parseInt(validTokens.get(tokenIdx++));
        height = Integer.parseInt(validTokens.get(tokenIdx++));
        playerX = Integer.parseInt(validTokens.get(tokenIdx++));
        playerY = Integer.parseInt(validTokens.get(tokenIdx++));
        int itemCount = Integer.parseInt(validTokens.get(tokenIdx++));
        for (int i = 0; i < itemCount; i++) {
            int ix = Integer.parseInt(validTokens.get(tokenIdx++));
            int iy = Integer.parseInt(validTokens.get(tokenIdx++));
            String iname = validTokens.get(tokenIdx++);
            items.add(new Item(ix, iy, iname));
        }

        // Read commands
        FileHandle cmdFile = Gdx.files.absolute(commandsPath);
        String[] cmdLines = cmdFile.readString("UTF-8").split("\\r?\\n");
        List<String> commands = new ArrayList<>();
        for (String line : cmdLines) {
            line = line.trim();
            if (line.isEmpty() || line.startsWith("#")) continue;
            commands.add(line);
        }

        scriptedInput = new ScriptedInput(commands);
        Gdx.input = scriptedInput;
    }

    @Override
    public void render() {
        if (finished) return;

        scriptedInput.tick();
        String rawCommand = scriptedInput.getCurrentRawCommand();
        if (rawCommand == null) {
            finishLoop();
            return;
        }

        turnCount++;
        boolean quit = false;

        if (Gdx.input.isKeyJustPressed(Keys.UP)) {
            if (playerY + 1 < height) playerY++;
        } else if (Gdx.input.isKeyJustPressed(Keys.DOWN)) {
            if (playerY - 1 >= 0) playerY--;
        } else if (Gdx.input.isKeyJustPressed(Keys.RIGHT)) {
            if (playerX + 1 < width) playerX++;
        } else if (Gdx.input.isKeyJustPressed(Keys.LEFT)) {
            if (playerX - 1 >= 0) playerX--;
        } else if (Gdx.input.isKeyJustPressed(Keys.SPACE)) { // PICK
            for (int i = 0; i < items.size(); i++) {
                Item item = items.get(i);
                if (item.x == playerX && item.y == playerY) {
                    inventory.add(item.name);
                    items.remove(i);
                    break;
                }
            }
        } else if (Gdx.input.isKeyJustPressed(Keys.ESCAPE)) { // QUIT
            quit = true;
        }

        String invStr = String.join(",", inventory);
        transcriptBuilder.append("turn=").append(turnCount)
            .append(" cmd=").append(rawCommand)
            .append(" pos=").append(playerX).append(",").append(playerY)
            .append(" inv=").append(invStr).append("\n");

        scriptedInput.consumeCommand();

        if (quit) {
            finishLoop();
        }
    }

    private void finishLoop() {
        finished = true;
        String invStr = String.join(",", inventory);
        transcriptBuilder.append("FINAL pos=").append(playerX).append(",").append(playerY)
            .append(" inv=").append(invStr)
            .append(" turns=").append(turnCount).append("\n");

        FileHandle transcriptFile = Gdx.files.absolute(transcriptPath);
        transcriptFile.writeString(transcriptBuilder.toString(), false, "UTF-8");

        Gdx.app.exit();
        latch.countDown();
    }

    @Override public void resize(int width, int height) {}
    @Override public void pause() {}
    @Override public void resume() {}
    @Override public void dispose() {}
}
