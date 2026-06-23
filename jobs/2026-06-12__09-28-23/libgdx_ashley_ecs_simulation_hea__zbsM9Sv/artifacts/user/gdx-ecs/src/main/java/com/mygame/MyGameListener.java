package com.mygame;

import com.badlogic.ashley.core.ComponentMapper;
import com.badlogic.ashley.core.Engine;
import com.badlogic.ashley.core.Entity;
import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.mygame.components.PositionComponent;
import com.mygame.components.VelocityComponent;
import com.mygame.systems.MovementSystem;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MyGameListener extends ApplicationAdapter {
    private final String scenarioPath;
    private Engine engine;
    private int totalTicks = 0;
    private int currentTick = 0;
    private boolean printed = false;
    
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

    public MyGameListener(String scenarioPath) {
        this.scenarioPath = scenarioPath;
    }

    @Override
    public void create() {
        engine = new Engine();
        engine.addSystem(new MovementSystem());

        try {
            parseScenarioFile();
        } catch (Exception e) {
            System.err.println("Error parsing scenario file: " + e.getMessage());
            e.printStackTrace();
            Gdx.app.exit();
            return;
        }
    }

    private void parseScenarioFile() throws IOException {
        FileHandle handle = Gdx.files.absolute(scenarioPath);
        if (!handle.exists()) {
            throw new IllegalArgumentException("Scenario file not found: " + scenarioPath);
        }

        try (BufferedReader reader = handle.reader(1024, "UTF-8")) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                String[] parts = line.split("\\s+");
                if (parts.length == 0) {
                    continue;
                }

                String token = parts[0];
                if ("TICKS".equals(token)) {
                    if (parts.length < 2) {
                        throw new IllegalArgumentException("Invalid TICKS line: " + line);
                    }
                    totalTicks = Integer.parseInt(parts[1]);
                } else if ("ENTITY".equals(token)) {
                    if (parts.length < 6) {
                        throw new IllegalArgumentException("Invalid ENTITY line: " + line);
                    }
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
    public void render() {
        if (currentTick < totalTicks) {
            engine.update(1.0f / 60.0f);
            currentTick++;
        }

        if (currentTick >= totalTicks && !printed) {
            printed = true;
            printFinalState();
            Gdx.app.exit();
        }
    }

    private void printFinalState() {
        System.out.println("TICK_COUNT " + totalTicks);
        for (EntityRecord record : entityRecords) {
            PositionComponent pos = pm.get(record.entity);
            String formattedX = formatFloat(pos.x);
            String formattedY = formatFloat(pos.y);
            System.out.println("ENTITY " + record.id + " x=" + formattedX + " y=" + formattedY);
        }
    }

    private String formatFloat(float value) {
        String formatted = String.format(Locale.ROOT, "%.3f", value);
        if (formatted.equals("-0.000") && Float.compare(value, -0.0f) != 0) {
            return "0.000";
        }
        return formatted;
    }
}
