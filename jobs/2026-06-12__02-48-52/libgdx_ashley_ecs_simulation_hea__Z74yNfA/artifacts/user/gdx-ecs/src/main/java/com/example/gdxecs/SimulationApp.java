package com.example.gdxecs;

import com.badlogic.ashley.core.Engine;
import com.badlogic.ashley.core.Entity;
import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;

import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * libGDX {@link ApplicationAdapter} that:
 * <ol>
 *   <li>Parses a scenario file on {@link #create()}.</li>
 *   <li>Advances the Ashley {@link Engine} once per {@link #render()} call
 *       with a deterministic fixed delta of {@code 1/60} s.</li>
 *   <li>Writes the final state to stdout after the requested number of ticks
 *       and calls {@code Gdx.app.exit()}.</li>
 * </ol>
 */
public class SimulationApp extends ApplicationAdapter {

    /** Fixed time step: 1/60 second, exactly as required. */
    private static final float FIXED_DT = 1.0f / 60.0f;

    private final String scenarioPath;
    private final PrintStream out;

    private Engine engine;

    /** Entity metadata kept in scenario-file order. */
    private final List<EntityRecord> entityRecords = new ArrayList<>();

    private int totalTicks;    // from TICKS line
    private int ticksDone = 0;
    private boolean finished = false;

    // -----------------------------------------------------------------------

    /**
     * @param scenarioPath absolute or relative path to the scenario file
     * @param out          the stream to write the final report to (normally System.out)
     */
    public SimulationApp(String scenarioPath, PrintStream out) {
        this.scenarioPath = scenarioPath;
        this.out = out;
    }

    // -----------------------------------------------------------------------
    // ApplicationListener lifecycle
    // -----------------------------------------------------------------------

    @Override
    public void create() {
        engine = new Engine();
        engine.addSystem(new MovementSystem());

        parseScenario();
    }

    @Override
    public void render() {
        if (finished) {
            return;
        }

        if (ticksDone < totalTicks) {
            engine.update(FIXED_DT);
            ticksDone++;
        }

        if (ticksDone == totalTicks) {
            finished = true;
            printResults();
            Gdx.app.exit();
        }
    }

    // -----------------------------------------------------------------------
    // Scenario parsing
    // -----------------------------------------------------------------------

    private void parseScenario() {
        FileHandle fh = Gdx.files.absolute(scenarioPath);
        String content = fh.readString("UTF-8");

        boolean ticksSeen = false;

        for (String raw : content.split("\\r?\\n")) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }

            if (line.startsWith("TICKS ")) {
                totalTicks = Integer.parseInt(line.substring(6).trim());
                ticksSeen = true;

            } else if (line.startsWith("ENTITY ")) {
                String[] parts = line.split("\\s+");
                // ENTITY <id> <x> <y> <vx> <vy>
                if (parts.length != 6) {
                    throw new IllegalArgumentException("Malformed ENTITY line: " + line);
                }
                String id = parts[1];
                float x  = Float.parseFloat(parts[2]);
                float y  = Float.parseFloat(parts[3]);
                float vx = Float.parseFloat(parts[4]);
                float vy = Float.parseFloat(parts[5]);

                Entity entity = new Entity();
                PositionComponent pos = new PositionComponent(x, y);
                VelocityComponent vel = new VelocityComponent(vx, vy);
                entity.add(pos);
                entity.add(vel);
                engine.addEntity(entity);

                entityRecords.add(new EntityRecord(id, pos));

            } else {
                throw new IllegalArgumentException("Unknown scenario directive: " + line);
            }
        }

        if (!ticksSeen) {
            throw new IllegalStateException("Scenario file is missing the TICKS line.");
        }
    }

    // -----------------------------------------------------------------------
    // Output
    // -----------------------------------------------------------------------

    private void printResults() {
        out.printf(Locale.ROOT, "TICK_COUNT %d%n", totalTicks);
        for (EntityRecord rec : entityRecords) {
            // Avoid -0.000: replace negative-zero float with positive zero.
            float fx = rec.pos.x == 0.0f ? 0.0f : rec.pos.x;
            float fy = rec.pos.y == 0.0f ? 0.0f : rec.pos.y;
            out.printf(Locale.ROOT, "ENTITY %s x=%.3f y=%.3f%n", rec.id, fx, fy);
        }
        out.flush();
    }

    // -----------------------------------------------------------------------
    // Inner helpers
    // -----------------------------------------------------------------------

    /** Lightweight struct pairing a scenario ID with its live PositionComponent. */
    private static final class EntityRecord {
        final String id;
        final PositionComponent pos;

        EntityRecord(String id, PositionComponent pos) {
            this.id  = id;
            this.pos = pos;
        }
    }
}
