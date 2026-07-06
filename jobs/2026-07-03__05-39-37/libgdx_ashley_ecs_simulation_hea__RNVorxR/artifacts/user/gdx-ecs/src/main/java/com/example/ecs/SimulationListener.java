package com.example.ecs;

import com.badlogic.ashley.core.Engine;
import com.badlogic.ashley.core.Entity;
import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;

import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * ApplicationListener that owns the Ashley engine, loads the scenario, advances
 * the engine a fixed number of ticks with a deterministic fixed time step, and
 * prints the final state to stdout before exiting the headless application.
 */
public class SimulationListener implements ApplicationListener {

    private static final float FIXED_DELTA = 1.0f / 60.0f;

    private final String scenarioPath;
    private final PrintStream out;

    private Engine engine;
    private MovementSystem movementSystem;
    private Scenario scenario;
    private final List<Entity> createdEntities = new ArrayList<>();

    private int ticksProcessed = 0;
    private boolean outputWritten = false;

    public SimulationListener(String scenarioPath) {
        this(scenarioPath, System.out);
    }

    public SimulationListener(String scenarioPath, PrintStream out) {
        this.scenarioPath = scenarioPath;
        this.out = out;
    }

    @Override
    public void create() {
        engine = new Engine();
        movementSystem = new MovementSystem();
        engine.addSystem(movementSystem);

        // Load the scenario file.
        String content = Gdx.files.absolute(scenarioPath).readString("UTF-8");
        scenario = Scenario.parse(content);

        // Create one Ashley entity per scenario line, preserving input order.
        for (Scenario.EntitySpec spec : scenario.entities) {
            Entity entity = engine.createEntity();
            entity.add(new Position(spec.x, spec.y));
            entity.add(new Velocity(spec.vx, spec.vy));
            engine.addEntity(entity);
            createdEntities.add(entity);
        }
    }

    @Override
    public void render() {
        if (outputWritten) {
            return;
        }

        if (ticksProcessed < scenario.ticks) {
            engine.update(FIXED_DELTA);
            ticksProcessed++;
        }

        if (ticksProcessed >= scenario.ticks) {
            writeOutput();
            outputWritten = true;
            Gdx.app.exit();
        }
    }

    private void writeOutput() {
        StringBuilder sb = new StringBuilder();
        sb.append("TICK_COUNT ").append(scenario.ticks).append('\n');
        for (Entity entity : createdEntities) {
            Position pos = Position.mapper.get(entity);
            String id = null;
            // Find the matching spec by identity order (entities are in input order).
            // We rely on createdEntities preserving the same order as scenario.entities.
            int idx = createdEntities.indexOf(entity);
            if (idx >= 0 && idx < scenario.entities.size()) {
                id = scenario.entities.get(idx).id;
            }
            sb.append("ENTITY ")
                    .append(id)
                    .append(" x=")
                    .append(formatFloat(pos.x))
                    .append(" y=")
                    .append(formatFloat(pos.y))
                    .append('\n');
        }
        out.print(sb);
        out.flush();
    }

    private static String formatFloat(float value) {
        // Use Locale.ROOT to guarantee a '.' decimal separator.
        String formatted = String.format(Locale.ROOT, "%.3f", value);
        // Normalize "-0.000" to "0.000" unless the value really is negative zero.
        if (formatted.equals("-0.000")) {
            // Check: is the underlying value actually negative zero?
            // Float.parseFloat("-0.000") == 0.0f, and Float.floatToRawIntBits(-0.0f) has sign bit set.
            if (Float.floatToRawIntBits(value) == Float.floatToRawIntBits(0.0f)) {
                formatted = "0.000";
            }
        }
        return formatted;
    }

    @Override
    public void resize(int width, int height) {
        // No-op for headless simulation.
    }

    @Override
    public void pause() {
        // No-op.
    }

    @Override
    public void resume() {
        // No-op.
    }

    @Override
    public void dispose() {
        // No-op.
    }
}