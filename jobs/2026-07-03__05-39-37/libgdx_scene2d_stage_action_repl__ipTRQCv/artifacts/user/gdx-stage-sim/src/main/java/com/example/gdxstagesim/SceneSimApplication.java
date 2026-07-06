package com.example.gdxstagesim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.actions.MoveByAction;

import java.io.BufferedWriter;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.regex.Pattern;

/**
 * Headless Scene2D application that:
 * <ol>
 *   <li>reads a script file from {@code Gdx.files.absolute(...)} in {@code create()},</li>
 *   <li>registers {@link Actor}s and queues {@link MoveByAction}s,</li>
 *   <li>advances every actor's action queue by a fixed {@code dt} once per
 *       {@code render()} tick for the requested number of ticks, and</li>
 *   <li>writes each actor's final 2D position to the output file from
 *       {@code dispose()}.</li>
 * </ol>
 *
 * <p>The simulation step is deterministic and independent of wall-clock time:
 * the {@code dt} value is parsed from the script file, not read from
 * {@code Gdx.graphics.getDeltaTime()}.</p>
 */
public class SceneSimApplication extends ApplicationAdapter {

    private static final Pattern ID_PATTERN = Pattern.compile("[A-Za-z0-9_]+");

    private final String scriptPath;
    private final String outputPath;
    private final CountDownLatch latch;

    /** Fixed simulation time step in seconds (parsed from the script). */
    private float dt;

    /** Total number of render() ticks to run (parsed from the script). */
    private int totalTicks;

    /** How many ticks have been executed so far. */
    private int tickCount = 0;

    /** Actors in declaration order (defines output order). */
    private final List<Actor> actors = new ArrayList<>();

    /** Quick lookup from actor id to Actor instance. */
    private final Map<String, Actor> actorsById = new LinkedHashMap<>();

    /** Ids that already have a moveby directive (at most one per actor). */
    private final Set<String> moveBySeen = new HashSet<>();

    public SceneSimApplication(String scriptPath, String outputPath, CountDownLatch latch) {
        this.scriptPath = scriptPath;
        this.outputPath = outputPath;
        this.latch = latch;
    }

    // ------------------------------------------------------------------
    // ApplicationAdapter lifecycle
    // ------------------------------------------------------------------

    @Override
    public void create() {
        String content = Gdx.files.absolute(scriptPath).readString("UTF-8");
        parseScript(content);
    }

    @Override
    public void render() {
        if (tickCount >= totalTicks) {
            // Simulation finished (or ticks == 0) — request shutdown.
            Gdx.app.exit();
            return;
        }
        // Advance every actor's action queue by the fixed dt.
        for (Actor actor : actors) {
            actor.act(dt);
        }
        tickCount++;
        if (tickCount >= totalTicks) {
            // This was the last tick — request shutdown after this render().
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        writeOutput();
        // Signal main() that the output file is flushed and the simulation is done.
        latch.countDown();
    }

    // ------------------------------------------------------------------
    // Script parsing
    // ------------------------------------------------------------------

    private void parseScript(String content) {
        boolean dtSet = false;
        boolean ticksSet = false;
        boolean actorSeen = false;

        String[] lines = content.split("\n", -1);
        int lineNo = 0;
        for (String rawLine : lines) {
            lineNo++;
            String line = rawLine.trim();
            if (line.isEmpty()) continue;
            if (line.startsWith("#")) continue;

            String[] tokens = line.split("\\s+");
            String directive = tokens[0].toLowerCase(Locale.ROOT);

            switch (directive) {
                case "dt": {
                    if (dtSet)
                        throw scriptError(lineNo, "dt declared more than once");
                    if (actorSeen)
                        throw scriptError(lineNo, "dt must appear before any actor directive");
                    expectTokens(lineNo, tokens, 2, "dt <float>");
                    dt = parseFloat(lineNo, tokens[1], "dt");
                    if (dt <= 0)
                        throw scriptError(lineNo, "dt must be > 0");
                    dtSet = true;
                    break;
                }
                case "ticks": {
                    if (ticksSet)
                        throw scriptError(lineNo, "ticks declared more than once");
                    if (actorSeen)
                        throw scriptError(lineNo, "ticks must appear before any actor directive");
                    expectTokens(lineNo, tokens, 2, "ticks <int>");
                    totalTicks = parseInt(lineNo, tokens[1], "ticks");
                    if (totalTicks < 0)
                        throw scriptError(lineNo, "ticks must be >= 0");
                    ticksSet = true;
                    break;
                }
                case "actor": {
                    if (!dtSet || !ticksSet)
                        throw scriptError(lineNo, "dt and ticks must appear before any actor directive");
                    actorSeen = true;
                    expectTokens(lineNo, tokens, 4, "actor <id> <x> <y>");
                    String id = tokens[1];
                    if (!ID_PATTERN.matcher(id).matches())
                        throw scriptError(lineNo, "invalid actor id: " + id);
                    if (actorsById.containsKey(id))
                        throw scriptError(lineNo, "duplicate actor id: " + id);
                    float x = parseFloat(lineNo, tokens[2], "x");
                    float y = parseFloat(lineNo, tokens[3], "y");
                    Actor actor = new Actor();
                    actor.setName(id);
                    actor.setPosition(x, y);
                    actors.add(actor);
                    actorsById.put(id, actor);
                    break;
                }
                case "moveby": {
                    expectTokens(lineNo, tokens, 5, "moveby <id> <dx> <dy> <duration>");
                    String id = tokens[1];
                    Actor target = actorsById.get(id);
                    if (target == null)
                        throw scriptError(lineNo, "moveby references unknown actor: " + id);
                    if (moveBySeen.contains(id))
                        throw scriptError(lineNo, "at most one moveby per actor: " + id);
                    float dx = parseFloat(lineNo, tokens[2], "dx");
                    float dy = parseFloat(lineNo, tokens[3], "dy");
                    float duration = parseFloat(lineNo, tokens[4], "duration");
                    if (duration < 0)
                        throw scriptError(lineNo, "duration must be >= 0");
                    moveBySeen.add(id);
                    // Actions.moveBy(amountX, amountY, duration) uses default
                    // linear interpolation (null Interpolation).
                    MoveByAction action = Actions.moveBy(dx, dy, duration);
                    target.addAction(action);
                    break;
                }
                default:
                    throw scriptError(lineNo, "unknown directive: " + directive);
            }
        }

        if (!dtSet)
            throw scriptError(0, "dt directive is missing");
        if (!ticksSet)
            throw scriptError(0, "ticks directive is missing");
    }

    // ------------------------------------------------------------------
    // Output
    // ------------------------------------------------------------------

    private void writeOutput() {
        try (BufferedWriter writer = new BufferedWriter(
                new OutputStreamWriter(new FileOutputStream(outputPath), StandardCharsets.UTF_8))) {
            for (Actor actor : actors) {
                String line = String.format(Locale.ROOT, "%s=%.6f,%.6f",
                        actor.getName(), actor.getX(), actor.getY());
                writer.write(line);
                writer.write("\n");
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to write output file: " + outputPath, e);
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private void expectTokens(int lineNo, String[] tokens, int expected, String syntax) {
        if (tokens.length < expected)
            throw scriptError(lineNo, "expected: " + syntax);
    }

    private float parseFloat(int lineNo, String token, String name) {
        try {
            return Float.parseFloat(token);
        } catch (NumberFormatException e) {
            throw scriptError(lineNo, "invalid " + name + " value: " + token);
        }
    }

    private int parseInt(int lineNo, String token, String name) {
        try {
            return Integer.parseInt(token);
        } catch (NumberFormatException e) {
            throw scriptError(lineNo, "invalid " + name + " value: " + token);
        }
    }

    private RuntimeException scriptError(int lineNo, String msg) {
        return new RuntimeException("Script error"
                + (lineNo > 0 ? " (line " + lineNo + ")" : "")
                + ": " + msg);
    }
}