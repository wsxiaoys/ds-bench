package com.gdxstagesim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.MoveByAction;

import java.io.BufferedReader;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

/**
 * Scene2D Action Replay under libGDX Headless Backend.
 *
 * <p>Reads a script describing actors and MoveByActions, runs a deterministic
 * tick-by-tick simulation using Scene2D's pure-CPU action logic, and writes
 * each actor's final position to an output file.</p>
 */
public class StageSim extends ApplicationAdapter {

    private final String scriptPath;
    private final String outputPath;
    private final CountDownLatch latch;

    private float dt;
    private int totalTicks;
    private int currentTick = 0;
    private final List<Actor> actors = new ArrayList<>();
    private final Map<String, Actor> actorMap = new LinkedHashMap<>();

    public StageSim(String scriptPath, String outputPath, CountDownLatch latch) {
        this.scriptPath = scriptPath;
        this.outputPath = outputPath;
        this.latch = latch;
    }

    @Override
    public void create() {
        try {
            parseScript();
        } catch (Exception e) {
            System.err.println("Error parsing script: " + e.getMessage());
            e.printStackTrace();
            Gdx.app.exit();
        }
    }

    private void parseScript() throws IOException {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(Gdx.files.absolute(scriptPath).read(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                String[] tokens = line.split("\\s+");
                String directive = tokens[0].toLowerCase(Locale.ROOT);

                switch (directive) {
                    case "dt":
                        dt = Float.parseFloat(tokens[1]);
                        break;
                    case "ticks":
                        totalTicks = Integer.parseInt(tokens[1]);
                        break;
                    case "actor": {
                        String id = tokens[1];
                        float x = Float.parseFloat(tokens[2]);
                        float y = Float.parseFloat(tokens[3]);
                        Actor actor = new Actor();
                        actor.setName(id);
                        actor.setPosition(x, y);
                        actors.add(actor);
                        actorMap.put(id, actor);
                        break;
                    }
                    case "moveby": {
                        String id = tokens[1];
                        float dx = Float.parseFloat(tokens[2]);
                        float dy = Float.parseFloat(tokens[3]);
                        float duration = Float.parseFloat(tokens[4]);
                        Actor targetActor = actorMap.get(id);
                        MoveByAction action = new MoveByAction();
                        action.setAmount(dx, dy);
                        action.setDuration(duration);
                        targetActor.addAction(action);
                        break;
                    }
                    default:
                        // Unknown directive; skip
                        break;
                }
            }
        }
    }

    @Override
    public void render() {
        if (currentTick < totalTicks) {
            for (Actor actor : actors) {
                actor.act(dt);
            }
            currentTick++;
        }

        if (currentTick >= totalTicks) {
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        try {
            writeOutput();
        } catch (Exception e) {
            System.err.println("Error writing output: " + e.getMessage());
            e.printStackTrace();
        } finally {
            latch.countDown();
        }
    }

    private void writeOutput() throws IOException {
        try (Writer writer = new OutputStreamWriter(
                new FileOutputStream(outputPath), StandardCharsets.UTF_8)) {
            for (Actor actor : actors) {
                String id = actor.getName();
                String x = String.format(Locale.ROOT, "%.6f", actor.getX());
                String y = String.format(Locale.ROOT, "%.6f", actor.getY());
                writer.write(id + "=" + x + "," + y + "\n");
            }
        }
    }

    public static void main(String[] args) throws InterruptedException {
        if (args.length < 2) {
            System.err.println("Usage: StageSim <script-path> <output-path>");
            System.exit(1);
        }

        String scriptPath = args[0];
        String outputPath = args[1];

        CountDownLatch latch = new CountDownLatch(1);
        StageSim sim = new StageSim(scriptPath, outputPath, latch);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        new HeadlessApplication(sim, config);

        // Wait for the simulation to complete and the output file to be written
        latch.await();
    }
}