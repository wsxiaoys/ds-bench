package com.sim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.utils.Pool;
import java.io.BufferedWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;

public class SimulationListener extends ApplicationAdapter {
    private final String scenarioPath;
    private final String outputPath;
    private final CountDownLatch latch;

    private Scenario scenario;
    private BufferedWriter writer;
    
    private final Pool<Projectile> projectilePool = new Pool<Projectile>() {
        @Override
        protected Projectile newObject() {
            return new Projectile();
        }
    };

    private List<Projectile> activeProjectiles = new ArrayList<>();
    private int currentTick = 0;
    private int totalSpawned = 0;
    private int totalGrounded = 0;
    private int peakActive = 0;

    public SimulationListener(String scenarioPath, String outputPath, CountDownLatch latch) {
        this.scenarioPath = scenarioPath;
        this.outputPath = outputPath;
        this.latch = latch;
    }

    @Override
    public void create() {
        try {
            scenario = Scenario.load(scenarioPath);
            writer = new BufferedWriter(Gdx.files.absolute(outputPath).writer(false, "UTF-8"));
            
            // Write header
            writeLine("TICKS " + scenario.ticks);
        } catch (Exception e) {
            Gdx.app.error("SimulationListener", "Error during initialization", e);
            latch.countDown();
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        if (scenario == null) return;

        if (currentTick >= scenario.ticks) {
            Gdx.app.exit();
            return;
        }

        try {
            // 1. Spawn every projectile scheduled for the current tick
            for (Scenario.Spawn spawn : scenario.spawns) {
                if (spawn.tick == currentTick) {
                    Projectile p = projectilePool.obtain();
                    p.id = spawn.id;
                    p.position.set(spawn.x, spawn.y);
                    p.velocity.set(spawn.vx, spawn.vy);
                    activeProjectiles.add(p);
                    totalSpawned++;
                }
            }

            // Track peak active projectiles
            peakActive = Math.max(peakActive, activeProjectiles.size());

            // 2. For each active projectile, apply gravity and then integrate position
            for (Projectile p : activeProjectiles) {
                p.velocity.x += scenario.gravityX;
                p.velocity.y += scenario.gravityY;
                p.position.x += p.velocity.x;
                p.position.y += p.velocity.y;
            }

            // 3. After integration, check grounding
            List<Projectile> remainingActive = new ArrayList<>();
            List<Projectile> groundedThisTick = new ArrayList<>();

            for (Projectile p : activeProjectiles) {
                if ((int) p.position.y <= scenario.floorY) {
                    groundedThisTick.add(p);
                } else {
                    remainingActive.add(p);
                }
            }

            // Write tick details
            writeLine("TICK " + currentTick + " ACTIVE " + remainingActive.size());

            for (Projectile p : remainingActive) {
                writeLine("P" + p.id + " x=" + (int) p.position.x + " y=" + (int) p.position.y + 
                          " vx=" + (int) p.velocity.x + " vy=" + (int) p.velocity.y);
            }

            for (Projectile p : groundedThisTick) {
                writeLine("GROUNDED P" + p.id + " tick=" + currentTick);
                totalGrounded++;
                projectilePool.free(p);
            }

            activeProjectiles = remainingActive;
            currentTick++;

            // If we have reached the end of ticks, request exit
            if (currentTick >= scenario.ticks) {
                Gdx.app.exit();
            }

        } catch (IOException e) {
            Gdx.app.error("SimulationListener", "Error during render at tick " + currentTick, e);
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        try {
            if (writer != null) {
                // Write final summary
                int poolFree = projectilePool.getFree();
                writeLine("SUMMARY spawned=" + totalSpawned + " grounded=" + totalGrounded + 
                          " pool_free=" + poolFree + " peak_active=" + peakActive);
                writer.flush();
                writer.close();
            }
        } catch (IOException e) {
            Gdx.app.error("SimulationListener", "Error during dispose", e);
        } finally {
            latch.countDown();
        }
    }

    private void writeLine(String line) throws IOException {
        writer.write(line);
        writer.write("\n");
    }
}
