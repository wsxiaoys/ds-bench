package com.example;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.ashley.core.Engine;
import com.badlogic.ashley.core.Entity;
import com.badlogic.ashley.core.Component;
import com.badlogic.ashley.core.EntitySystem;
import com.badlogic.ashley.core.Family;
import com.badlogic.ashley.utils.ImmutableArray;

import java.io.BufferedReader;
import java.io.FileReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class GdxEcsApp extends ApplicationAdapter {
    private String scenarioPath;
    private int targetTicks = 0;
    private int currentTicks = 0;
    private Engine engine;
    private List<Entity> entityOrder = new ArrayList<>();

    public GdxEcsApp(String scenarioPath) {
        this.scenarioPath = scenarioPath;
    }

    @Override
    public void create() {
        engine = new Engine();
        engine.addSystem(new MovementSystem());

        try (BufferedReader reader = new BufferedReader(new FileReader(scenarioPath))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;

                String[] parts = line.split("\\s+");
                if (parts[0].equals("TICKS")) {
                    targetTicks = Integer.parseInt(parts[1]);
                } else if (parts[0].equals("ENTITY")) {
                    String id = parts[1];
                    float x = Float.parseFloat(parts[2]);
                    float y = Float.parseFloat(parts[3]);
                    float vx = Float.parseFloat(parts[4]);
                    float vy = Float.parseFloat(parts[5]);

                    Entity entity = new Entity();
                    entity.add(new IdComponent(id));
                    entity.add(new PositionComponent(x, y));
                    entity.add(new VelocityComponent(vx, vy));
                    engine.addEntity(entity);
                    entityOrder.add(entity);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            Gdx.app.exit();
        }
        
        if (targetTicks == 0) {
            printResults();
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        if (currentTicks < targetTicks) {
            engine.update(1.0f / 60.0f);
            currentTicks++;
            
            if (currentTicks >= targetTicks) {
                printResults();
                Gdx.app.exit();
            }
        }
    }

    private String formatFloat(float v) {
        String s = String.format(Locale.ROOT, "%.3f", v);
        if (s.equals("-0.000")) {
            if (Float.floatToIntBits(v) == 0x80000000) {
                return "-0.000";
            } else {
                return "0.000";
            }
        }
        return s;
    }

    private void printResults() {
        System.out.println("TICK_COUNT " + targetTicks);
        for (Entity entity : entityOrder) {
            IdComponent idC = entity.getComponent(IdComponent.class);
            PositionComponent posC = entity.getComponent(PositionComponent.class);
            System.out.printf(Locale.ROOT, "ENTITY %s x=%s y=%s\n", idC.id, formatFloat(posC.x), formatFloat(posC.y));
        }
    }

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Missing scenario file");
            System.exit(1);
        }
        
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60;
        
        GdxEcsApp app = new GdxEcsApp(args[0]);
        new HeadlessApplication(app, config);
        
        Thread headlessThread = null;
        for (Thread t : Thread.getAllStackTraces().keySet()) {
            if (t.getName().equals("HeadlessApplication")) {
                headlessThread = t;
                break;
            }
        }
        
        if (headlessThread != null) {
            try {
                headlessThread.join();
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }
}

class IdComponent implements Component {
    public String id;
    public IdComponent(String id) { this.id = id; }
}

class PositionComponent implements Component {
    public float x, y;
    public PositionComponent(float x, float y) { this.x = x; this.y = y; }
}

class VelocityComponent implements Component {
    public float x, y;
    public VelocityComponent(float x, float y) { this.x = x; this.y = y; }
}

class MovementSystem extends EntitySystem {
    private ImmutableArray<Entity> entities;

    @Override
    public void addedToEngine(Engine engine) {
        entities = engine.getEntitiesFor(Family.all(PositionComponent.class, VelocityComponent.class).get());
    }

    @Override
    public void update(float deltaTime) {
        for (int i = 0; i < entities.size(); ++i) {
            Entity entity = entities.get(i);
            PositionComponent position = entity.getComponent(PositionComponent.class);
            VelocityComponent velocity = entity.getComponent(VelocityComponent.class);
            
            position.x += velocity.x * deltaTime;
            position.y += velocity.y * deltaTime;
        }
    }
}
