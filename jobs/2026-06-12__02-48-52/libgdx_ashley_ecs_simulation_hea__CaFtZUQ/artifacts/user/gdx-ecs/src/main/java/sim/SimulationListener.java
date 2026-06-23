package sim;

import com.badlogic.ashley.core.ComponentMapper;
import com.badlogic.ashley.core.Engine;
import com.badlogic.ashley.core.Entity;
import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class SimulationListener implements ApplicationListener {

    private Engine engine;
    private int totalTicks;
    private int ticksRemaining;
    private boolean done = false;
    private final String scenarioPath;
    private final List<String> entityIds = new ArrayList<>();
    private final List<Entity> entities = new ArrayList<>();
    private final ComponentMapper<PositionComponent> pm = ComponentMapper.getFor(PositionComponent.class);

    public SimulationListener(String scenarioPath) {
        this.scenarioPath = scenarioPath;
    }

    @Override
    public void create() {
        engine = new Engine();
        engine.addSystem(new MovementSystem());
        loadScenario();
    }

    private void loadScenario() {
        try {
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(Gdx.files.absolute(scenarioPath).read(), "UTF-8"));
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                String[] parts = line.split("\\s+");
                if (parts[0].equals("TICKS")) {
                    totalTicks = Integer.parseInt(parts[1]);
                    ticksRemaining = totalTicks;
                } else if (parts[0].equals("ENTITY")) {
                    String id = parts[1];
                    float x = Float.parseFloat(parts[2]);
                    float y = Float.parseFloat(parts[3]);
                    float vx = Float.parseFloat(parts[4]);
                    float vy = Float.parseFloat(parts[5]);

                    Entity entity = new Entity();
                    PositionComponent pos = new PositionComponent();
                    pos.x = x;
                    pos.y = y;
                    VelocityComponent vel = new VelocityComponent();
                    vel.x = vx;
                    vel.y = vy;
                    entity.add(pos);
                    entity.add(vel);
                    engine.addEntity(entity);

                    entityIds.add(id);
                    entities.add(entity);
                }
            }
            reader.close();
        } catch (Exception e) {
            throw new RuntimeException("Failed to load scenario: " + scenarioPath, e);
        }
    }

    @Override
    public void render() {
        if (ticksRemaining <= 0) {
            if (!done) {
                done = true;
                printOutput();
            }
            Gdx.app.exit();
            return;
        }

        float fixedDt = 1.0f / 60.0f;
        engine.update(fixedDt);
        ticksRemaining--;
    }

    private void printOutput() {
        System.out.println(String.format(Locale.ROOT, "TICK_COUNT %d", totalTicks));
        for (int i = 0; i < entities.size(); i++) {
            Entity entity = entities.get(i);
            PositionComponent pos = pm.get(entity);
            System.out.println(String.format(Locale.ROOT, "ENTITY %s x=%.3f y=%.3f",
                entityIds.get(i), pos.x, pos.y));
        }
    }

    @Override
    public void pause() {}

    @Override
    public void resume() {}

    @Override
    public void resize(int width, int height) {}

    @Override
    public void dispose() {}
}