package com.example.sim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.MoveByAction;
import com.badlogic.gdx.utils.Array;

import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

public class SimulationListener extends ApplicationAdapter {

    private final String scriptPath;
    private final String outputPath;
    private final CountDownLatch doneLatch;

    private float dt;
    private int ticks;

    private final List<Actor> actorsInOrder = new ArrayList<>();
    private final Map<String, Actor> actorsById = new HashMap<>();

    private int tickCount = 0;
    private boolean started = false;

    public SimulationListener(String scriptPath, String outputPath, CountDownLatch doneLatch) {
        this.scriptPath = scriptPath;
        this.outputPath = outputPath;
        this.doneLatch = doneLatch;
    }

    @Override
    public void create() {
        parseScript();
        started = true;

        // ticks=0 is valid: exit immediately after create()
        if (ticks == 0) {
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        if (!started) {
            return;
        }

        // Advance every actor's action queue by dt.
        for (Actor actor : actorsInOrder) {
            actor.act(dt);
        }

        tickCount++;

        if (tickCount >= ticks) {
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        try {
            writeOutput();
        } finally {
            doneLatch.countDown();
        }
    }

    // ── Script parsing ──────────────────────────────────────────────────

    private void parseScript() {
        FileHandle file = Gdx.files.absolute(scriptPath);
        String text = file.readString("UTF-8");

        String[] lines = text.split("\n");

        boolean dtSeen = false;
        boolean ticksSeen = false;

        for (int lineNum = 0; lineNum < lines.length; lineNum++) {
            String raw = lines[lineNum];

            // Trim trailing CR (for CRLF files) and trim whitespace
            String line = raw.replaceAll("\\r$", "").trim();

            // Skip blank lines and comments
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }

            // Split on one or more whitespace characters
            String[] tokens = line.split("\\s+");

            if (tokens.length == 0) {
                continue;
            }

            String directive = tokens[0].toLowerCase(Locale.ROOT);

            switch (directive) {
                case "dt":
                    if (dtSeen) {
                        throw new IllegalArgumentException("Duplicate 'dt' directive at line " + (lineNum + 1));
                    }
                    if (tokens.length != 2) {
                        throw new IllegalArgumentException("'dt' directive requires exactly 1 argument at line " + (lineNum + 1));
                    }
                    dt = Float.parseFloat(tokens[1]);
                    if (dt <= 0) {
                        throw new IllegalArgumentException("'dt' must be > 0 at line " + (lineNum + 1));
                    }
                    dtSeen = true;
                    break;

                case "ticks":
                    if (ticksSeen) {
                        throw new IllegalArgumentException("Duplicate 'ticks' directive at line " + (lineNum + 1));
                    }
                    if (tokens.length != 2) {
                        throw new IllegalArgumentException("'ticks' directive requires exactly 1 argument at line " + (lineNum + 1));
                    }
                    ticks = Integer.parseInt(tokens[1]);
                    if (ticks < 0) {
                        throw new IllegalArgumentException("'ticks' must be >= 0 at line " + (lineNum + 1));
                    }
                    ticksSeen = true;
                    break;

                case "actor":
                    if (!dtSeen || !ticksSeen) {
                        throw new IllegalArgumentException("'actor' directive must appear after 'dt' and 'ticks' at line " + (lineNum + 1));
                    }
                    if (tokens.length != 4) {
                        throw new IllegalArgumentException("'actor' directive requires exactly 3 arguments at line " + (lineNum + 1));
                    }
                    {
                        String id = tokens[1];
                        if (!id.matches("[A-Za-z0-9_]+")) {
                            throw new IllegalArgumentException("Invalid actor id '" + id + "' at line " + (lineNum + 1));
                        }
                        if (actorsById.containsKey(id)) {
                            throw new IllegalArgumentException("Duplicate actor id '" + id + "' at line " + (lineNum + 1));
                        }
                        float x = Float.parseFloat(tokens[2]);
                        float y = Float.parseFloat(tokens[3]);

                        Actor actor = new Actor();
                        actor.setPosition(x, y);
                        // Name is not used for logic but helps identify the actor
                        actor.setName(id);

                        actorsInOrder.add(actor);
                        actorsById.put(id, actor);
                    }
                    break;

                case "moveby":
                    if (tokens.length != 5) {
                        throw new IllegalArgumentException("'moveby' directive requires exactly 4 arguments at line " + (lineNum + 1));
                    }
                    {
                        String id = tokens[1];
                        Actor actor = actorsById.get(id);
                        if (actor == null) {
                            throw new IllegalArgumentException("Unknown actor id '" + id + "' in 'moveby' at line " + (lineNum + 1));
                        }
                        float dx = Float.parseFloat(tokens[2]);
                        float dy = Float.parseFloat(tokens[3]);
                        float duration = Float.parseFloat(tokens[4]);
                        if (duration < 0) {
                            throw new IllegalArgumentException("'moveby' duration must be >= 0 at line " + (lineNum + 1));
                        }

                        // Check: at most one moveby per actor
                        // Scene2D's Actor.getActions() returns the action Array.
                        // An actor with no moveby will have an empty or null action list.
                        Array<com.badlogic.gdx.scenes.scene2d.Action> actions = actor.getActions();
                        if (actions != null && actions.size > 0) {
                            throw new IllegalArgumentException("Actor '" + id + "' already has a moveby action at line " + (lineNum + 1));
                        }

                        MoveByAction moveBy = new MoveByAction();
                        moveBy.setAmount(dx, dy);
                        moveBy.setDuration(duration);
                        actor.addAction(moveBy);
                    }
                    break;

                default:
                    throw new IllegalArgumentException("Unknown directive '" + tokens[0] + "' at line " + (lineNum + 1));
            }
        }

        if (!dtSeen) {
            throw new IllegalArgumentException("Missing 'dt' directive in script.");
        }
        if (!ticksSeen) {
            throw new IllegalArgumentException("Missing 'ticks' directive in script.");
        }
    }

    // ── Output writing ──────────────────────────────────────────────────

    private void writeOutput() {
        FileHandle file = Gdx.files.absolute(outputPath);
        try (Writer writer = new OutputStreamWriter(file.write(false), StandardCharsets.UTF_8)) {
            for (Actor actor : actorsInOrder) {
                writer.write(String.format(Locale.ROOT, "%s=%.6f,%.6f%n",
                        actor.getName(), actor.getX(), actor.getY()));
            }
            writer.flush();
        } catch (IOException e) {
            throw new RuntimeException("Failed to write output file: " + outputPath, e);
        }
    }
}
