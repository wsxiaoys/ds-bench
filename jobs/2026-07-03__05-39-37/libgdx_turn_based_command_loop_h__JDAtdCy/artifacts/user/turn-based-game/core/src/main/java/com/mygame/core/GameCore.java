package com.mygame.core;

import java.util.ArrayList;
import java.util.List;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.files.FileHandle;

/**
 * Deterministic, headless-friendly game core implementing
 * {@link ApplicationListener}.
 *
 * <p>One turn is consumed per {@link #render()} tick: a single command is read
 * from the scripted input, the in-memory world is mutated, and a single
 * transcript line is appended. The loop ends when either a {@code QUIT} command
 * has just been recorded or the command file is exhausted; in both cases the
 * transcript (a {@code FINAL} line plus all per-turn lines) is flushed with a
 * single {@link FileHandle#writeString(String, boolean)} call and
 * {@link Gdx#app}{@code .exit()} is invoked.</p>
 */
public class GameCore implements ApplicationListener {

    private final ScriptedInput input;
    private final String mapPath;
    private final String commandsPath;
    private final String transcriptPath;

    // World state
    private int width;
    private int height;
    private int playerX;
    private int playerY;
    private final List<Item> items = new ArrayList<Item>();
    private final List<String> inventory = new ArrayList<String>();

    // Transcript / loop bookkeeping
    private int turnCount = 0;
    private final StringBuilder transcript = new StringBuilder();
    private boolean finished = false;

    public GameCore(ScriptedInput input, String mapPath, String commandsPath, String transcriptPath) {
        this.input = input;
        this.mapPath = mapPath;
        this.commandsPath = commandsPath;
        this.transcriptPath = transcriptPath;
    }

    @Override
    public void create() {
        parseMap();
        loadCommands();
    }

    @Override
    public void render() {
        // After Gdx.app.exit() the headless main loop fires one extra render()
        // tick (the exit runnable is processed by executeRunnables() at the top
        // of the next iteration, then render() runs, then the loop breaks).
        // Guard against that trailing tick so we never double-process a command.
        if (finished) {
            return;
        }

        // Advance to the next command before reading the (mock) keyboard.
        input.tick();

        if (input.isExhausted()) {
            finish();
            return;
        }

        int turn = ++turnCount;
        String raw = input.currentRaw();

        // Resolve the command through the scripted MockInput's key API.
        boolean up = input.isKeyJustPressed(Input.Keys.UP);
        boolean down = input.isKeyJustPressed(Input.Keys.DOWN);
        boolean right = input.isKeyJustPressed(Input.Keys.RIGHT);
        boolean left = input.isKeyJustPressed(Input.Keys.LEFT);
        boolean pick = input.isKeyJustPressed(Input.Keys.SPACE);
        boolean quit = input.isKeyJustPressed(Input.Keys.ESCAPE);

        if (up) {
            tryMove(0, 1);
        } else if (down) {
            tryMove(0, -1);
        } else if (right) {
            tryMove(1, 0);
        } else if (left) {
            tryMove(-1, 0);
        } else if (pick) {
            tryPick();
        }
        // quit & unknown commands: no state change, but the turn still counts.

        appendTurnLine(turn, raw);

        if (quit) {
            finish();
        }
    }

    private void tryMove(int dx, int dy) {
        int nx = playerX + dx;
        int ny = playerY + dy;
        // Reject moves that would leave the map; the player stays in place but
        // the turn still counts.
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            playerX = nx;
            playerY = ny;
        }
    }

    private void tryPick() {
        // Items are stored in definition order, so the first match is the one
        // defined earliest in the map file.
        Item found = null;
        for (Item item : items) {
            if (item.x == playerX && item.y == playerY) {
                found = item;
                break;
            }
        }
        if (found != null) {
            items.remove(found);
            inventory.add(found.name);
        }
        // else: no item here -> no-op.
    }

    private void appendTurnLine(int turn, String raw) {
        transcript.append("turn=").append(turn)
                .append(" cmd=").append(raw)
                .append(" pos=").append(playerX).append(",").append(playerY)
                .append(" inv=").append(inventoryString())
                .append('\n');
    }

    private void finish() {
        if (finished) {
            return;
        }
        transcript.append("FINAL pos=").append(playerX).append(",").append(playerY)
                .append(" inv=").append(inventoryString())
                .append(" turns=").append(turnCount)
                .append('\n');
        // Single overwrite write so partial transcripts are never visible.
        Gdx.files.absolute(transcriptPath).writeString(transcript.toString(), false, "UTF-8");
        finished = true;
        Gdx.app.exit();
    }

    private String inventoryString() {
        if (inventory.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < inventory.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(inventory.get(i));
        }
        return sb.toString();
    }

    private void parseMap() {
        String content = Gdx.files.absolute(mapPath).readString("UTF-8");
        List<String> tokens = tokenize(content);

        int idx = 0;
        width = Integer.parseInt(tokens.get(idx++));
        height = Integer.parseInt(tokens.get(idx++));
        playerX = Integer.parseInt(tokens.get(idx++));
        playerY = Integer.parseInt(tokens.get(idx++));
        int itemCount = Integer.parseInt(tokens.get(idx++));

        for (int i = 0; i < itemCount; i++) {
            int x = Integer.parseInt(tokens.get(idx++));
            int y = Integer.parseInt(tokens.get(idx++));
            String name = tokens.get(idx++);
            items.add(new Item(x, y, name));
        }
    }

    private void loadCommands() {
        String content = Gdx.files.absolute(commandsPath).readString("UTF-8");
        List<String> commands = new ArrayList<String>();
        for (String line : content.split("\n", -1)) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            commands.add(trimmed);
        }
        input.setCommands(commands);
    }

    /**
     * Splits map-file content into whitespace-separated tokens, ignoring blank
     * lines and lines beginning with {@code #}.
     */
    private static List<String> tokenize(String content) {
        List<String> tokens = new ArrayList<String>();
        for (String line : content.split("\n", -1)) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            for (String tok : trimmed.split("\\s+")) {
                if (!tok.isEmpty()) {
                    tokens.add(tok);
                }
            }
        }
        return tokens;
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
}