package com.example.turnbased.core;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;

import java.util.List;
import java.util.concurrent.CountDownLatch;

/**
 * Headless {@link ApplicationListener} that drives the deterministic turn
 * loop. One command is consumed per {@link #render()} call, the world is
 * mutated accordingly, and a transcript line is buffered. When the input is
 * exhausted or a {@code QUIT} command is processed, the transcript is
 * flushed to disk and the application is asked to exit.
 */
public final class GameListener implements ApplicationListener {

    private final ScriptedMockInput input;
    private final String mapPath;
    private final String commandsPath;
    private final String transcriptPath;

    private final CountDownLatch doneLatch = new CountDownLatch(1);
    private final StringBuilder transcript = new StringBuilder();

    private World world;
    private int turnsProcessed = 0;
    private boolean exiting = false;
    private boolean finalized = false;

    public GameListener(ScriptedMockInput input,
                        String mapPath,
                        String commandsPath,
                        String transcriptPath) {
        this.input = input;
        this.mapPath = mapPath;
        this.commandsPath = commandsPath;
        this.transcriptPath = transcriptPath;
    }

    public CountDownLatch getDoneLatch() {
        return doneLatch;
    }

    @Override
    public void create() {
        // By the time create() runs, the HeadlessApplication has already
        // populated the static Gdx.* fields, so the libGDX file API is safe.
        List<String> commands = CommandsLoader.load(commandsPath);
        input.setCommands(commands);
        world = MapLoader.load(mapPath);
    }

    @Override
    public void render() {
        if (exiting) {
            return;
        }

        input.tick();

        if (!input.hasCommand()) {
            // Command file has been fully consumed without an explicit QUIT.
            finalizeTranscript();
            return;
        }

        String cmd = input.currentCommand();
        applyCommand(cmd);
        turnsProcessed++;

        transcript.append("turn=").append(turnsProcessed)
                  .append(" cmd=").append(cmd)
                  .append(" pos=").append(world.playerX).append(',').append(world.playerY)
                  .append(" inv=").append(formatInventory())
                  .append('\n');

        if ("QUIT".equals(cmd)) {
            finalizeTranscript();
        }
    }

    private void applyCommand(String cmd) {
        switch (cmd) {
            case "N":
                world.tryMove(0, 1);
                break;
            case "S":
                world.tryMove(0, -1);
                break;
            case "E":
                world.tryMove(1, 0);
                break;
            case "W":
                world.tryMove(-1, 0);
                break;
            case "PICK":
                world.tryPick();
                break;
            case "QUIT":
                // Marker for end-of-loop; the actual handling lives in render().
                break;
            default:
                // Unknown command: no-op, but the raw token is still recorded.
                break;
        }
    }

    private String formatInventory() {
        List<String> inv = world.getInventory();
        if (inv.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < inv.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(inv.get(i));
        }
        return sb.toString();
    }

    private void finalizeTranscript() {
        if (finalized) {
            return;
        }
        finalized = true;
        exiting = true;

        transcript.append("FINAL pos=").append(world.playerX).append(',').append(world.playerY)
                  .append(" inv=").append(formatInventory())
                  .append(" turns=").append(turnsProcessed)
                  .append('\n');

        FileHandle fh = Gdx.files.absolute(transcriptPath);
        fh.writeString(transcript.toString(), false);

        Gdx.app.exit();
    }

    @Override
    public void resize(int width, int height) {
        // Headless: nothing to relayout.
    }

    @Override
    public void pause() {
        // No-op for the headless turn loop.
    }

    @Override
    public void resume() {
        // No-op for the headless turn loop.
    }

    @Override
    public void dispose() {
        // Safety net so the launcher's main thread never blocks forever if
        // the loop exits before finalize() ever ran.
        doneLatch.countDown();
    }
}