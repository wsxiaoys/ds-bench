package com.dungeon.core;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.files.FileHandle;

import java.util.ArrayList;
import java.util.List;

/**
 * The deterministic game engine. Reads the map from a file, consumes one command
 * per render() tick via ScriptedMockInput, and writes a transcript line per turn.
 */
public class GameListener implements ApplicationListener {

    private final String mapPath;
    private final String transcriptPath;

    // World state
    private int mapWidth;
    private int mapHeight;
    private int playerX;
    private int playerY;
    private List<Item> worldItems; // all items in the world, in map-definition order
    private List<String> inventory; // names of picked-up items, in pickup order
    private List<String> transcriptLines; // accumulated transcript lines
    private int turnCount;
    private boolean quitReceived;
    private boolean transcriptFlushed;

    public GameListener(String mapPath, String transcriptPath) {
        this.mapPath = mapPath;
        this.transcriptPath = transcriptPath;
    }

    @Override
    public void create() {
        loadMap();
        this.inventory = new ArrayList<>();
        this.transcriptLines = new ArrayList<>();
        this.turnCount = 0;
        this.quitReceived = false;
        this.transcriptFlushed = false;
    }

    @Override
    public void render() {
        ScriptedMockInput input = (ScriptedMockInput) Gdx.input;

        // Advance to the next command
        String rawCmd = input.tick();

        if (rawCmd == null) {
            // No more commands -- finish
            flushTranscript();
            Gdx.app.exit();
            return;
        }

        if (quitReceived) {
            // QUIT was already processed last tick; we should have exited already,
            // but just in case, flush and exit.
            flushTranscript();
            Gdx.app.exit();
            return;
        }

        // Process the command
        processCommand(rawCmd);

        turnCount++;

        // Build transcript line
        String invStr = String.join(",", inventory);
        String line = "turn=" + turnCount + " cmd=" + rawCmd + " pos=" + playerX + "," + playerY + " inv=" + invStr;
        transcriptLines.add(line);

        if (quitReceived) {
            // Write FINAL line, flush, and exit
            flushTranscript();
            Gdx.app.exit();
        }
    }

    private void processCommand(String rawCmd) {
        // Determine which key is active
        int key = mapCommandToKey(rawCmd);

        if (key == -1) {
            // Unknown command: no state change, but still counts as a turn
            return;
        }

        switch (key) {
            case Input.Keys.UP:    // N
                movePlayer(0, 1);
                break;
            case Input.Keys.DOWN:  // S
                movePlayer(0, -1);
                break;
            case Input.Keys.RIGHT: // E
                movePlayer(1, 0);
                break;
            case Input.Keys.LEFT:  // W
                movePlayer(-1, 0);
                break;
            case Input.Keys.SPACE: // PICK
                pickItem();
                break;
            case Input.Keys.ESCAPE: // QUIT
                quitReceived = true;
                break;
        }
    }

    private int mapCommandToKey(String cmd) {
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

    private void movePlayer(int dx, int dy) {
        int newX = playerX + dx;
        int newY = playerY + dy;
        if (newX >= 0 && newX < mapWidth && newY >= 0 && newY < mapHeight) {
            playerX = newX;
            playerY = newY;
        }
        // else: movement rejected, stay in place
    }

    private void pickItem() {
        // Find the first item (in map-definition order) at the player's position
        for (int i = 0; i < worldItems.size(); i++) {
            Item item = worldItems.get(i);
            if (item.x == playerX && item.y == playerY) {
                inventory.add(item.name);
                worldItems.remove(i);
                return;
            }
        }
        // No item at this position: no-op
    }

    private void loadMap() {
        FileHandle file = Gdx.files.absolute(mapPath);
        String content = file.readString("UTF-8");
        String[] lines = content.split("\\R");

        // Parse lines, skipping blanks and comments
        List<String> tokens = new ArrayList<>();
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            // Split on whitespace
            String[] parts = trimmed.split("\\s+");
            for (String part : parts) {
                tokens.add(part);
            }
        }

        int idx = 0;
        // WIDTH HEIGHT
        mapWidth = Integer.parseInt(tokens.get(idx++));
        mapHeight = Integer.parseInt(tokens.get(idx++));
        // PLAYER_X PLAYER_Y
        playerX = Integer.parseInt(tokens.get(idx++));
        playerY = Integer.parseInt(tokens.get(idx++));
        // ITEM_COUNT
        int itemCount = Integer.parseInt(tokens.get(idx++));

        worldItems = new ArrayList<>();
        for (int i = 0; i < itemCount; i++) {
            int x = Integer.parseInt(tokens.get(idx++));
            int y = Integer.parseInt(tokens.get(idx++));
            String name = tokens.get(idx++);
            worldItems.add(new Item(x, y, name));
        }
    }

    private void flushTranscript() {
        if (transcriptFlushed) {
            return;
        }
        transcriptFlushed = true;

        // Add FINAL line
        String invStr = String.join(",", inventory);
        String finalLine = "FINAL pos=" + playerX + "," + playerY + " inv=" + invStr + " turns=" + turnCount;
        transcriptLines.add(finalLine);

        // Write all lines to the transcript file
        StringBuilder sb = new StringBuilder();
        for (String line : transcriptLines) {
            sb.append(line).append('\n');
        }

        FileHandle out = Gdx.files.absolute(transcriptPath);
        out.writeString(sb.toString(), false, "UTF-8");
    }

    @Override
    public void resize(int width, int height) {
    }

    @Override
    public void pause() {
    }

    @Override
    public void resume() {
    }

    @Override
    public void dispose() {
    }

    private static class Item {
        final int x;
        final int y;
        final String name;

        Item(int x, int y, String name) {
            this.x = x;
            this.y = y;
            this.name = name;
        }
    }
}
