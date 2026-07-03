package com.mygame.core;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;

public class GameListener implements ApplicationListener {
    private final String mapPath;
    private final String commandsPath;
    private final String transcriptPath;
    private final CountDownLatch latch;

    private GameMap gameMap;
    private int playerX;
    private int playerY;
    private List<String> inventory;
    private StringBuilder transcript;
    private int turnCount;

    public GameListener(String mapPath, String commandsPath, String transcriptPath, CountDownLatch latch) {
        this.mapPath = mapPath;
        this.commandsPath = commandsPath;
        this.transcriptPath = transcriptPath;
        this.latch = latch;
    }

    @Override
    public void create() {
        try {
            gameMap = MapParser.parse(Gdx.files.absolute(mapPath));
            playerX = gameMap.playerStartX;
            playerY = gameMap.playerStartY;
        } catch (IOException e) {
            throw new RuntimeException("Failed to parse map file: " + mapPath, e);
        }
        inventory = new ArrayList<>();
        transcript = new StringBuilder();
        turnCount = 0;
    }

    @Override
    public void resize(int width, int height) {
    }

    @Override
    public void render() {
        try {
            GameInput input = (GameInput) Gdx.input;
            if (input == null) return;

            input.tick();
            String cmd = input.getCurrentCommand();

            if (cmd == null) {
                if (turnCount == 0) {
                    writeFinalAndExit();
                }
                return;
            }

            turnCount++;
            processCommand();

            appendTurnTranscript(turnCount, cmd);

            if (cmd.equals("QUIT") || input.isExhausted()) {
                writeFinalAndExit();
            }
        } catch (Throwable t) {
            t.printStackTrace();
            latch.countDown();
            Gdx.app.exit();
        }
    }

    private void processCommand() {
        if (Gdx.input.isKeyJustPressed(com.badlogic.gdx.Input.Keys.UP)) {
            if (playerY + 1 < gameMap.height) {
                playerY++;
            }
        } else if (Gdx.input.isKeyJustPressed(com.badlogic.gdx.Input.Keys.DOWN)) {
            if (playerY - 1 >= 0) {
                playerY--;
            }
        } else if (Gdx.input.isKeyJustPressed(com.badlogic.gdx.Input.Keys.RIGHT)) {
            if (playerX + 1 < gameMap.width) {
                playerX++;
            }
        } else if (Gdx.input.isKeyJustPressed(com.badlogic.gdx.Input.Keys.LEFT)) {
            if (playerX - 1 >= 0) {
                playerX--;
            }
        } else if (Gdx.input.isKeyJustPressed(com.badlogic.gdx.Input.Keys.SPACE)) {
            for (GameMap.Item item : gameMap.items) {
                if (item.x == playerX && item.y == playerY && !item.pickedUp) {
                    item.pickedUp = true;
                    inventory.add(item.name);
                    break;
                }
            }
        } else if (Gdx.input.isKeyJustPressed(com.badlogic.gdx.Input.Keys.ESCAPE)) {
            // QUIT - no-op for position/inventory
        }
    }

    private void appendTurnTranscript(int turn, String cmd) {
        String invStr = String.join(",", inventory);
        transcript.append("turn=").append(turn)
                  .append(" cmd=").append(cmd)
                  .append(" pos=").append(playerX).append(",").append(playerY)
                  .append(" inv=").append(invStr)
                  .append("\n");
    }

    private void writeFinalAndExit() {
        String invStr = String.join(",", inventory);
        transcript.append("FINAL pos=").append(playerX).append(",").append(playerY)
                  .append(" inv=").append(invStr)
                  .append(" turns=").append(turnCount)
                  .append("\n");

        try {
            Gdx.files.absolute(transcriptPath).writeString(transcript.toString(), false, "UTF-8");
        } catch (Exception e) {
            e.printStackTrace();
        }

        Gdx.app.exit();
        latch.countDown();
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
}
