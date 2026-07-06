package com.mygame;

import com.badlogic.ashley.core.ComponentMapper;
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
    private final String scenarioPath;
    private Engine engine;
    private int totalTicks = 0;
    private int ticksProcessed = 0;
    private boolean finished = false;
    
    private final List<EntityRecord> entityRecords = new ArrayList<>();
    private final ComponentMapper<PositionComponent> pm = ComponentMapper.getFor(PositionComponent.class);

    public static class EntityRecord {
        public final String id;
        public final Entity entity;

        public EntityRecord(String id, Entity entity) {
            this.id = id;
            this.entity = entity;
        }
    }

    public SimulationListener(String scenarioPath) {
        this.scenarioPath = scenarioPath;
    }

    @Override
    public void create() {
        engine = new Engine();
        engine.addSystem(new MovementSystem());

        try {
            parseScenario();
        } catch (IOException e) {
            System.err.println("Error reading scenario file: " + e.getMessage());
            Gdx.app.exit();
            finished = true;
        }
    }

    private void parseScenario() throws IOException {
        FileHandle file = Gdx.files.absolute(scenarioPath);
        if (!file.exists()) {
            throw new IOException("File does not exist: " + scenarioPath);
        }

        try (BufferedReader reader = new BufferedReader(file.reader("UTF-8"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                String[] parts = line.split("\\s+");
                if (parts.length == 0) continue;

                if (parts[0].equals("TICKS")) {
                    totalTicks = Integer.parseInt(parts[1]);
                } else if (parts[0].equals("ENTITY")) {
                    String id = parts[1];
                    float x = Float.parseFloat(parts[2]);
                    float y = Float.parseFloat(parts[3]);
                    float vx = Float.parseFloat(parts[4]);
                    float vy = Float.parseFloat(parts[5]);

                    Entity entity = new Entity();
                    PositionComponent pos = new PositionComponent(x, y);
                    VelocityComponent vel = new VelocityComponent(vx, vy);
                    entity.add(pos);
                    entity.add(vel);

                    engine.addEntity(entity);
                    entityRecords.add(new EntityRecord(id, entity));
                }
            }
        }
    }

    @Override
    public void resize(int width, int height) {}

    @Override
    public void render() {
        if (finished) return;

        if (ticksProcessed < totalTicks) {
            engine.update(1.0f / 60.0f);
            ticksProcessed++;
        }

        if (ticksProcessed == totalTicks) {
            printResultsAndExit();
        }
    }

    private void printResultsAndExit() {
        if (finished) return;
        finished = true;

        System.out.println("TICK_COUNT " + totalTicks);
        for (EntityRecord record : entityRecords) {
            PositionComponent pos = pm.get(record.entity);
            String xStr = formatCoordinate(pos.x);
            String yStr = formatCoordinate(pos.y);
            System.out.println("ENTITY " + record.id + " x=" + xStr + " y=" + yStr);
        }

        Gdx.app.exit();
    }

    public static String formatCoordinate(float val) {
        if (Float.compare(val, -0.0f) == 0) {
            return "-0.000";
        }
        String formatted = String.format(Locale.ROOT, "%.3f", val);
        if (formatted.equals("-0.000")) {
            return "0.000";
        }
        return formatted;
    }

    @Override
    public void pause() {}

    @Override
    public void resume() {}

    @Override
    public void dispose() {}
}
