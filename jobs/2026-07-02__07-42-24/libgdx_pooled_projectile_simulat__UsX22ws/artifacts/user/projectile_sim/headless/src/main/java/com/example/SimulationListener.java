package com.example;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.Pool;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CountDownLatch;

public class SimulationListener implements ApplicationListener {
    private final String scenarioPath;
    private final String outputPath;
    private final CountDownLatch latch;

    private int ticks = -1;
    private int gravityX = 0;
    private int gravityY = 0;
    private int floorY = 0;

    private static class SpawnEvent {
        int id;
        int tick;
        int x, y;
        int vx, vy;
    }

    private final List<SpawnEvent> spawnEvents = new ArrayList<>();
    private final List<Projectile> activeProjectiles = new ArrayList<>();
    private final Pool<Projectile> projectilePool = new Pool<Projectile>() {
        @Override
        protected Projectile newObject() {
            return new Projectile();
        }
    };

    private int currentTick = 0;
    private int totalSpawnedDirectives = 0;
    private int totalGrounded = 0;
    private int peakActive = 0;
    private boolean summaryWritten = false;

    private BufferedWriter writer;

    public SimulationListener(String scenarioPath, String outputPath, CountDownLatch latch) {
        this.scenarioPath = scenarioPath;
        this.outputPath = outputPath;
        this.latch = latch;
    }

    @Override
    public void create() {
        // Parse scenario file
        FileHandle scenarioFile = Gdx.files.absolute(scenarioPath);
        try (BufferedReader reader = scenarioFile.reader(1024, "UTF-8")) {
            String line;
            int spawnId = 0;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                String[] parts = line.split("\\s+");
                if (parts.length == 0) continue;
                String directive = parts[0];
                if (directive.equals("TICKS")) {
                    ticks = Integer.parseInt(parts[1]);
                } else if (directive.equals("GRAVITY")) {
                    gravityX = Integer.parseInt(parts[1]);
                    gravityY = Integer.parseInt(parts[2]);
                } else if (directive.equals("FLOOR")) {
                    floorY = Integer.parseInt(parts[1]);
                } else if (directive.equals("SPAWN")) {
                    SpawnEvent ev = new SpawnEvent();
                    ev.id = spawnId++;
                    ev.tick = Integer.parseInt(parts[1]);
                    ev.x = Integer.parseInt(parts[2]);
                    ev.y = Integer.parseInt(parts[3]);
                    ev.vx = Integer.parseInt(parts[4]);
                    ev.vy = Integer.parseInt(parts[5]);
                    spawnEvents.add(ev);
                }
            }
            totalSpawnedDirectives = spawnId;
        } catch (Exception e) {
            e.printStackTrace();
            Gdx.app.exit();
            return;
        }

        // Open output writer
        try {
            FileHandle outputFile = Gdx.files.absolute(outputPath);
            // Ensure parent directory exists
            outputFile.parent().mkdirs();
            writer = new BufferedWriter(outputFile.writer(false, "UTF-8"));
            
            // Write header
            writer.write("TICKS " + ticks + "\n");
        } catch (Exception e) {
            e.printStackTrace();
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        if (ticks < 0) {
            Gdx.app.exit();
            return;
        }

        if (ticks == 0) {
            if (currentTick == 0) {
                writeSummaryAndExit();
            }
            return;
        }

        if (currentTick >= ticks) {
            return;
        }

        try {
            // 1. Spawn every projectile scheduled for the current tick
            for (SpawnEvent ev : spawnEvents) {
                if (ev.tick == currentTick) {
                    Projectile p = projectilePool.obtain();
                    p.init(ev.id, ev.x, ev.y, ev.vx, ev.vy);
                    activeProjectiles.add(p);
                }
            }

            // Update peak active count
            peakActive = Math.max(peakActive, activeProjectiles.size());

            // 2. Sort active projectiles by spawn-id to ensure deterministic order
            activeProjectiles.sort(Comparator.comparingInt(p -> p.id));

            // 3. Apply gravity to velocity and then add velocity to position
            for (Projectile p : activeProjectiles) {
                p.velocity.x = (int) p.velocity.x + gravityX;
                p.velocity.y = (int) p.velocity.y + gravityY;
                p.position.x = (int) p.position.x + (int) p.velocity.x;
                p.position.y = (int) p.position.y + (int) p.velocity.y;
            }

            // 4. Check grounding: y <= floorY after integration
            List<Projectile> groundedThisTick = new ArrayList<>();
            for (Projectile p : activeProjectiles) {
                if ((int) p.position.y <= floorY) {
                    groundedThisTick.add(p);
                }
            }

            // Remove grounded from active list
            for (Projectile p : groundedThisTick) {
                activeProjectiles.remove(p);
                totalGrounded++;
            }

            // 5. Write log lines for this tick
            // Format:
            // TICK <t> ACTIVE <count>
            // P<id> x=<x> y=<y> vx=<vx> vy=<vy> (for each active)
            // GROUNDED P<id> tick=<t> (for each grounded)
            writer.write("TICK " + currentTick + " ACTIVE " + activeProjectiles.size() + "\n");
            for (Projectile p : activeProjectiles) {
                writer.write("P" + p.id + " x=" + (int) p.position.x + " y=" + (int) p.position.y +
                             " vx=" + (int) p.velocity.x + " vy=" + (int) p.velocity.y + "\n");
            }
            for (Projectile p : groundedThisTick) {
                writer.write("GROUNDED P" + p.id + " tick=" + currentTick + "\n");
                projectilePool.free(p); // Free back to pool
            }

            currentTick++;

            if (currentTick == ticks) {
                writeSummaryAndExit();
            }
        } catch (IOException e) {
            e.printStackTrace();
            Gdx.app.exit();
        }
    }

    private void writeSummaryAndExit() {
        if (summaryWritten) return;
        summaryWritten = true;
        try {
            if (writer != null) {
                // SUMMARY spawned=<S> grounded=<G> pool_free=<F> peak_active=<P>
                writer.write("SUMMARY spawned=" + totalSpawnedDirectives +
                             " grounded=" + totalGrounded +
                             " pool_free=" + projectilePool.getFree() +
                             " peak_active=" + peakActive + "\n");
                writer.flush();
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        Gdx.app.exit();
    }

    @Override
    public void resize(int width, int height) {}

    @Override
    public void pause() {}

    @Override
    public void resume() {}

    @Override
    public void dispose() {
        try {
            if (writer != null) {
                writer.close();
            }
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            latch.countDown();
        }
    }
}
