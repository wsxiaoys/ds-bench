package com.example.turnbased.core;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.files.FileHandle;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.StringJoiner;
import java.util.concurrent.CountDownLatch;

/**
 * Deterministic turn-based game core that can run on libGDX's headless backend.
 */
public final class DungeonGame implements ApplicationListener {
    private final String mapPath;
    private final String transcriptPath;
    private final CountDownLatch disposedLatch = new CountDownLatch(1);

    private World world;
    private final StringBuilder transcript = new StringBuilder();
    private boolean finished;
    private int turnCount;

    public DungeonGame(String mapPath, String transcriptPath) {
        this.mapPath = mapPath;
        this.transcriptPath = transcriptPath;
    }

    @Override
    public void create() {
        world = loadWorld(mapPath);
        Gdx.files.absolute(transcriptPath).writeString("", false, StandardCharsets.UTF_8.name());
    }

    @Override
    public void resize(int width, int height) {
        // No rendering surface exists on the headless backend.
    }

    @Override
    public void render() {
        if (finished) {
            return;
        }

        if (!(Gdx.input instanceof ScriptedCommandInput input)) {
            return;
        }

        if (!input.tick()) {
            finish();
            return;
        }

        String command = input.getCurrentCommand();
        executeCommand(command);
        turnCount++;
        appendTurnLine(command);

        if (Gdx.input.isKeyJustPressed(Input.Keys.ESCAPE)) {
            finish();
        }
    }

    @Override
    public void pause() {
        // No-op for deterministic headless execution.
    }

    @Override
    public void resume() {
        // No-op for deterministic headless execution.
    }

    @Override
    public void dispose() {
        disposedLatch.countDown();
    }

    public void awaitDisposed() throws InterruptedException {
        disposedLatch.await();
    }

    private void executeCommand(String command) {
        if (Gdx.input.isKeyJustPressed(Input.Keys.UP)) {
            move(0, 1);
        } else if (Gdx.input.isKeyJustPressed(Input.Keys.DOWN)) {
            move(0, -1);
        } else if (Gdx.input.isKeyJustPressed(Input.Keys.RIGHT)) {
            move(1, 0);
        } else if (Gdx.input.isKeyJustPressed(Input.Keys.LEFT)) {
            move(-1, 0);
        } else if (Gdx.input.isKeyJustPressed(Input.Keys.SPACE)) {
            pickUpItemAtPlayer();
        }
    }

    private void move(int dx, int dy) {
        int nextX = world.playerX + dx;
        int nextY = world.playerY + dy;
        if (nextX >= 0 && nextX < world.width && nextY >= 0 && nextY < world.height) {
            world.playerX = nextX;
            world.playerY = nextY;
        }
    }

    private void pickUpItemAtPlayer() {
        for (int index = 0; index < world.items.size(); index++) {
            Item item = world.items.get(index);
            if (item.x == world.playerX && item.y == world.playerY) {
                world.inventory.add(item.name);
                world.items.remove(index);
                return;
            }
        }
    }

    private void appendTurnLine(String command) {
        transcript.append("turn=")
                .append(turnCount)
                .append(" cmd=")
                .append(command)
                .append(" pos=")
                .append(world.playerX)
                .append(',')
                .append(world.playerY)
                .append(" inv=")
                .append(renderInventory())
                .append('\n');
    }

    private void finish() {
        if (finished) {
            return;
        }
        finished = true;
        transcript.append("FINAL pos=")
                .append(world.playerX)
                .append(',')
                .append(world.playerY)
                .append(" inv=")
                .append(renderInventory())
                .append(" turns=")
                .append(turnCount)
                .append('\n');
        FileHandle transcriptFile = Gdx.files.absolute(transcriptPath);
        transcriptFile.writeString(transcript.toString(), false, StandardCharsets.UTF_8.name());
        Gdx.app.exit();
    }

    private String renderInventory() {
        StringJoiner joiner = new StringJoiner(",");
        for (String itemName : world.inventory) {
            joiner.add(itemName);
        }
        return joiner.toString();
    }

    private static World loadWorld(String mapPath) {
        String text = Gdx.files.absolute(mapPath).readString(StandardCharsets.UTF_8.name());
        List<String> tokens = new ArrayList<>();
        String[] lines = text.split("\\R");
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            String[] lineTokens = trimmed.split("\\s+");
            for (String token : lineTokens) {
                tokens.add(token);
            }
        }

        TokenCursor cursor = new TokenCursor(tokens);
        int width = cursor.nextInt("WIDTH");
        int height = cursor.nextInt("HEIGHT");
        int playerX = cursor.nextInt("PLAYER_X");
        int playerY = cursor.nextInt("PLAYER_Y");
        int itemCount = cursor.nextInt("ITEM_COUNT");

        List<Item> items = new ArrayList<>();
        for (int i = 0; i < itemCount; i++) {
            int x = cursor.nextInt("item X");
            int y = cursor.nextInt("item Y");
            String name = cursor.next("item NAME");
            items.add(new Item(x, y, name));
        }

        return new World(width, height, playerX, playerY, items);
    }

    private static final class TokenCursor {
        private final List<String> tokens;
        private int index;

        private TokenCursor(List<String> tokens) {
            this.tokens = tokens;
        }

        private String next(String fieldName) {
            if (index >= tokens.size()) {
                throw new IllegalArgumentException("Map file is missing " + fieldName);
            }
            return tokens.get(index++);
        }

        private int nextInt(String fieldName) {
            String token = next(fieldName);
            try {
                return Integer.parseInt(token);
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException("Map field " + fieldName + " must be an integer: " + token, exception);
            }
        }
    }

    private static final class World {
        private final int width;
        private final int height;
        private int playerX;
        private int playerY;
        private final List<Item> items;
        private final List<String> inventory = new ArrayList<>();

        private World(int width, int height, int playerX, int playerY, List<Item> items) {
            this.width = width;
            this.height = height;
            this.playerX = playerX;
            this.playerY = playerY;
            this.items = items;
        }
    }

    private record Item(int x, int y, String name) {
    }
}
