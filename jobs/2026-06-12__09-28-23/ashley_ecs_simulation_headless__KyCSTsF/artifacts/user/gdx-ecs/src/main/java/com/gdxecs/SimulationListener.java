package com.gdxecs;

import com.badlogic.ashley.core.Engine;
import com.badlogic.ashley.core.Entity;
import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class SimulationListener implements ApplicationListener {

    private static final float FIXED_DT = 1.0f / 60.0f;

    private final String scenarioPath;
    private Engine engine;
    private MovementSystem movementSystem;
    private int totalTicks;
    private int currentTick;
    private boolean printed;
    private List<Entity> entitiesInOrder;
    private List<String> entityIdsInOrder;

    public SimulationListener(String scenarioPath) {
        this.scenarioPath = scenarioPath;
    }

    @Override
    public void create() {
        engine = new Engine();
        movementSystem = new MovementSystem();
        engine.addSystem(movementSystem);

        entitiesInOrder = new ArrayList<>();
        entityIdsInOrder = new ArrayList<>();

        FileHandle file = Gdx.files.absolute(scenarioPath);
        try (BufferedReader reader = new BufferedReader(file.reader("UTF-8"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                if (line.startsWith("TICKS ")) {
                    String ticksStr = line.substring(6).trim();
                    totalTicks = Integer.parseInt(ticksStr);
                } else if (line.startsWith("ENTITY ")) {
                    String[] parts = line.split("\\s+");
                    // parts[0] = "ENTITY", parts[1] = id, parts[2..5] = floats
                    String id = parts[1];
                    float x = Float.parseFloat(parts[2]);
                    float y = Float.parseFloat(parts[3]);
                    float vx = Float.parseFloat(parts[4]);
                    float vy = Float.parseFloat(parts[5]);

                    Entity entity = new Entity();
                    entity.add(new Position(x, y));
                    entity.add(new Velocity(vx, vy));
                    engine.addEntity(entity);

                    entitiesInOrder.add(entity);
                    entityIdsInOrder.add(id);
                }
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to read scenario file: " + scenarioPath, e);
        }

        currentTick = 0;
        printed = false;
    }

    @Override
    public void resize(int width, int height) {
    }

    @Override
    public void render() {
        if (currentTick >= totalTicks) {
            if (!printed) {
                printFinalState();
                printed = true;
            }
            Gdx.app.exit();
            return;
        }

        engine.update(FIXED_DT);
        currentTick++;
    }

    private void printFinalState() {
        StringBuilder sb = new StringBuilder();
        sb.append("TICK_COUNT ").append(totalTicks).append('\n');
        for (int i = 0; i < entitiesInOrder.size(); i++) {
            Entity entity = entitiesInOrder.get(i);
            String id = entityIdsInOrder.get(i);
            Position pos = entity.getComponent(Position.class);
            sb.append("ENTITY ").append(id)
              .append(" x=").append(formatFloat(pos.x))
              .append(" y=").append(formatFloat(pos.y))
              .append('\n');
        }
        System.out.print(sb.toString());
        System.out.flush();
    }

    private static String formatFloat(float value) {
        // Use Locale.ROOT and %.3f, handle -0.000 case
        if (value == 0.0f && Float.floatToRawIntBits(value) == Float.floatToRawIntBits(-0.0f)) {
            return "-0.000";
        }
        return String.format(Locale.ROOT, "%.3f", value);
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
