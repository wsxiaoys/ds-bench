package com.mygame.core;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import java.io.BufferedReader;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;

public class MyGame extends ApplicationAdapter {
    private final String mapPath;
    private final String transcriptPath;
    private final ScriptedInput input;
    private final CountDownLatch latch;

    private int width;
    private int height;
    private int playerX;
    private int playerY;
    private List<Item> items = new ArrayList<>();
    private final List<String> inventory = new ArrayList<>();

    private final StringBuilder transcriptBuilder = new StringBuilder();
    private int turnCount = 0;
    private boolean finished = false;

    public MyGame(String mapPath, String transcriptPath, ScriptedInput input, CountDownLatch latch) {
        this.mapPath = mapPath;
        this.transcriptPath = transcriptPath;
        this.input = input;
        this.latch = latch;
    }

    @Override
    public void create() {
        loadMap();
    }

    private void loadMap() {
        try {
            String content = Gdx.files.absolute(mapPath).readString("UTF-8");
            List<String> tokens = new ArrayList<>();
            try (BufferedReader reader = new BufferedReader(new StringReader(content))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    String trimmed = line.trim();
                    if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                        continue;
                    }
                    // Split by whitespace
                    String[] parts = trimmed.split("\\s+");
                    for (String part : parts) {
                        if (!part.isEmpty()) {
                            tokens.add(part);
                        }
                    }
                }
            }

            if (tokens.size() < 5) {
                throw new RuntimeException("Invalid map file: too few tokens");
            }

            int ptr = 0;
            this.width = Integer.parseInt(tokens.get(ptr++));
            this.height = Integer.parseInt(tokens.get(ptr++));
            this.playerX = Integer.parseInt(tokens.get(ptr++));
            this.playerY = Integer.parseInt(tokens.get(ptr++));
            int itemCount = Integer.parseInt(tokens.get(ptr++));

            this.items = new ArrayList<>();
            for (int i = 0; i < itemCount; i++) {
                if (ptr + 2 >= tokens.size()) {
                    throw new RuntimeException("Invalid map file: item tokens missing");
                }
                int itemX = Integer.parseInt(tokens.get(ptr++));
                int itemY = Integer.parseInt(tokens.get(ptr++));
                String itemName = tokens.get(ptr++);
                items.add(new Item(itemX, itemY, itemName));
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to read or parse map file: " + mapPath, e);
        }
    }

    @Override
    public void render() {
        if (finished) {
            return;
        }

        if (!input.tick()) {
            // Command file exhausted
            writeFinalAndExit();
            return;
        }

        turnCount++;
        String rawCommand = input.getCurrentCommand();

        // Process movement and action using Gdx.input (which is the ScriptedInput instance)
        if (Gdx.input.isKeyJustPressed(Input.Keys.UP)) {
            if (playerY + 1 < height) {
                playerY++;
            }
        } else if (Gdx.input.isKeyJustPressed(Input.Keys.DOWN)) {
            if (playerY - 1 >= 0) {
                playerY--;
            }
        } else if (Gdx.input.isKeyJustPressed(Input.Keys.RIGHT)) {
            if (playerX + 1 < width) {
                playerX++;
            }
        } else if (Gdx.input.isKeyJustPressed(Input.Keys.LEFT)) {
            if (playerX - 1 >= 0) {
                playerX--;
            }
        } else if (Gdx.input.isKeyJustPressed(Input.Keys.SPACE)) {
            pickItem();
        } else if (Gdx.input.isKeyJustPressed(Input.Keys.ESCAPE)) {
            // QUIT - no state change
        }

        String invStr = String.join(",", inventory);
        transcriptBuilder.append(String.format("turn=%d cmd=%s pos=%d,%d inv=%s\n",
            turnCount, rawCommand, playerX, playerY, invStr));

        if (Gdx.input.isKeyJustPressed(Input.Keys.ESCAPE)) {
            writeFinalAndExit();
        }
    }

    private void pickItem() {
        for (Item item : items) {
            if (!item.pickedUp && item.x == playerX && item.y == playerY) {
                item.pickedUp = true;
                inventory.add(item.name);
                break; // pick up exactly one item (the earliest defined)
            }
        }
    }

    private void writeFinalAndExit() {
        finished = true;
        String invStr = String.join(",", inventory);
        transcriptBuilder.append(String.format("FINAL pos=%d,%d inv=%s turns=%d\n",
            playerX, playerY, invStr, turnCount));

        try {
            Gdx.files.absolute(transcriptPath).writeString(transcriptBuilder.toString(), false, "UTF-8");
        } catch (Exception e) {
            e.printStackTrace();
        }

        Gdx.app.exit();
    }

    @Override
    public void dispose() {
        latch.countDown();
    }
}
