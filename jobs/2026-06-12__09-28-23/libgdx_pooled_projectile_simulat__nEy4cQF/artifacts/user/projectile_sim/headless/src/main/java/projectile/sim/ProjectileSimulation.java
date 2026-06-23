package projectile.sim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.Pool;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.Writer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class ProjectileSimulation extends ApplicationAdapter {
    private final String scenarioPath;
    private final String outputPath;
    private final List<Projectile> active = new ArrayList<>();
    private final List<Integer> groundedThisTick = new ArrayList<>();
    private final Pool<Projectile> projectilePool = new Pool<Projectile>() {
        @Override
        protected Projectile newObject() {
            return new Projectile();
        }
    };

    private Scenario scenario;
    private Writer writer;
    private int currentTick;
    private int nextSpawnIndex;
    private int groundedCount;
    private int peakActive;
    private boolean finished;

    public ProjectileSimulation(String scenarioPath, String outputPath) {
        this.scenarioPath = scenarioPath;
        this.outputPath = outputPath;
    }

    @Override
    public void create() {
        scenario = Scenario.read(Gdx.files.absolute(scenarioPath));
        FileHandle output = Gdx.files.absolute(outputPath);
        if (output.parent() != null) {
            output.parent().mkdirs();
        }
        writer = new BufferedWriter(output.writer(false, "UTF-8"));
        writeLine("TICKS " + scenario.ticks);
    }

    @Override
    public void render() {
        if (finished) {
            return;
        }

        if (currentTick >= scenario.ticks) {
            finish();
            return;
        }

        groundedThisTick.clear();
        spawnCurrentTick();
        if (active.size() > peakActive) {
            peakActive = active.size();
        }

        integrateActiveProjectiles();
        writeTickTranscript();

        currentTick++;
        if (currentTick >= scenario.ticks) {
            finish();
        }
    }

    @Override
    public void dispose() {
        if (writer != null) {
            try {
                writer.close();
            } catch (IOException e) {
                throw new RuntimeException("Failed to close output file: " + outputPath, e);
            } finally {
                writer = null;
            }
        }
    }

    private void spawnCurrentTick() {
        while (nextSpawnIndex < scenario.spawns.size()) {
            Scenario.Spawn spawn = scenario.spawns.get(nextSpawnIndex);
            if (spawn.tick != currentTick) {
                break;
            }

            Projectile projectile = projectilePool.obtain();
            projectile.initialize(spawn.id, spawn.x, spawn.y, spawn.vx, spawn.vy);
            active.add(projectile);
            nextSpawnIndex++;
        }
        active.sort(Comparator.comparingInt(p -> p.id));
    }

    private void integrateActiveProjectiles() {
        for (int i = 0; i < active.size(); ) {
            Projectile projectile = active.get(i);
            projectile.velocity.add(scenario.gravityX, scenario.gravityY);
            projectile.position.add(projectile.velocity);

            if ((int) projectile.position.y <= scenario.floorY) {
                groundedThisTick.add(projectile.id);
                active.remove(i);
                projectilePool.free(projectile);
                groundedCount++;
            } else {
                i++;
            }
        }
    }

    private void writeTickTranscript() {
        writeLine("TICK " + currentTick + " ACTIVE " + active.size());
        for (Projectile projectile : active) {
            writeLine("P" + projectile.id
                    + " x=" + (int) projectile.position.x
                    + " y=" + (int) projectile.position.y
                    + " vx=" + (int) projectile.velocity.x
                    + " vy=" + (int) projectile.velocity.y);
        }
        for (Integer projectileId : groundedThisTick) {
            writeLine("GROUNDED P" + projectileId + " tick=" + currentTick);
        }
    }

    private void finish() {
        if (finished) {
            return;
        }
        finished = true;
        writeLine("SUMMARY spawned=" + scenario.spawns.size()
                + " grounded=" + groundedCount
                + " pool_free=" + projectilePool.getFree()
                + " peak_active=" + peakActive);
        try {
            writer.flush();
        } catch (IOException e) {
            throw new RuntimeException("Failed to flush output file: " + outputPath, e);
        }
        Gdx.app.exit();
    }

    private void writeLine(String line) {
        try {
            writer.write(line);
            writer.write('\n');
        } catch (IOException e) {
            throw new RuntimeException("Failed to write output file: " + outputPath, e);
        }
    }
}
