package com.example.gdxecs;

import com.badlogic.ashley.core.Engine;
import com.badlogic.ashley.core.Entity;
import com.badlogic.gdx.Application;
import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;

import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class SimulationApplication implements ApplicationListener {
    private static final float FIXED_DELTA_TIME = 1.0f / 60.0f;

    private final String scenarioPath;
    private final PrintStream output;
    private final List<Entity> orderedEntities = new ArrayList<>();

    private Engine engine;
    private int targetTicks;
    private int processedTicks;
    private boolean outputWritten;
    private volatile Throwable failure;

    public SimulationApplication(String scenarioPath, PrintStream output) {
        this.scenarioPath = scenarioPath;
        this.output = output;
    }

    @Override
    public void create() {
        try {
            Gdx.app.setLogLevel(Application.LOG_NONE);
            engine = new Engine();
            engine.addSystem(new MovementSystem());

            Scenario scenario = ScenarioParser.parse(scenarioPath);
            targetTicks = scenario.ticks;

            for (Scenario.EntitySpec spec : scenario.entities) {
                Entity entity = new Entity();
                entity.add(new IdComponent(spec.id));
                entity.add(new PositionComponent(spec.x, spec.y));
                entity.add(new VelocityComponent(spec.vx, spec.vy));
                orderedEntities.add(entity);
                engine.addEntity(entity);
            }

            if (targetTicks == 0) {
                writeOutputAndExit();
            }
        } catch (Throwable t) {
            failure = t;
            t.printStackTrace(System.err);
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        if (outputWritten) {
            return;
        }

        try {
            engine.update(FIXED_DELTA_TIME);
            processedTicks++;

            if (processedTicks == targetTicks) {
                writeOutputAndExit();
            }
        } catch (Throwable t) {
            failure = t;
            t.printStackTrace(System.err);
            Gdx.app.exit();
        }
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

    public Throwable getFailure() {
        return failure;
    }

    private void writeOutputAndExit() {
        StringBuilder builder = new StringBuilder();
        builder.append("TICK_COUNT ").append(targetTicks).append('\n');
        for (Entity entity : orderedEntities) {
            IdComponent id = entity.getComponent(IdComponent.class);
            PositionComponent position = entity.getComponent(PositionComponent.class);
            builder.append("ENTITY ")
                    .append(id.id)
                    .append(" x=")
                    .append(formatCoordinate(position.x))
                    .append(" y=")
                    .append(formatCoordinate(position.y))
                    .append('\n');
        }
        output.print(builder);
        output.flush();
        outputWritten = true;
        Gdx.app.exit();
    }

    private static String formatCoordinate(float value) {
        String formatted = String.format(Locale.ROOT, "%.3f", value);
        if ("-0.000".equals(formatted) && Float.floatToRawIntBits(value) != Float.floatToRawIntBits(-0.0f)) {
            return "0.000";
        }
        return formatted;
    }
}
