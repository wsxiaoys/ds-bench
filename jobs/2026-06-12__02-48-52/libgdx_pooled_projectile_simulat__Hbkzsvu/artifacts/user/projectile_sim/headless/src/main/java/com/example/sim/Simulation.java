package com.example.sim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.math.Vector2;
import com.badlogic.gdx.utils.Pool;
import com.badlogic.gdx.utils.Array;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CountDownLatch;

public class Simulation extends ApplicationAdapter {
    private final String scenarioPath;
    private final String outputPath;
    private final CountDownLatch latch;

    private int totalTicks = 0;
    private int gravityX = 0;
    private int gravityY = 0;
    private int floorY = 0;

    private int currentTick = 0;

    static class SpawnEvent {
        int tick;
        int id;
        int x, y, vx, vy;
    }

    private List<SpawnEvent> spawns = new ArrayList<>();

    static class Projectile implements Pool.Poolable {
        int id;
        Vector2 position = new Vector2();
        Vector2 velocity = new Vector2();

        @Override
        public void reset() {
            id = -1;
            position.set(0, 0);
            velocity.set(0, 0);
        }
    }

    private Pool<Projectile> pool = new Pool<Projectile>() {
        @Override
        protected Projectile newObject() {
            return new Projectile();
        }
    };

    private Array<Projectile> activeProjectiles = new Array<>();
    
    private BufferedWriter writer;

    private int totalSpawned = 0;
    private int totalGrounded = 0;
    private int peakActive = 0;

    public Simulation(String scenarioPath, String outputPath, CountDownLatch latch) {
        this.scenarioPath = scenarioPath;
        this.outputPath = outputPath;
        this.latch = latch;
    }

    @Override
    public void create() {
        try {
            FileHandle scenarioFile = Gdx.files.absolute(scenarioPath);
            String[] lines = scenarioFile.readString("UTF-8").split("\\r?\\n");
            
            for (String line : lines) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;
                String[] parts = line.split("\\s+");
                if (parts[0].equals("TICKS")) {
                    totalTicks = Integer.parseInt(parts[1]);
                } else if (parts[0].equals("GRAVITY")) {
                    gravityX = Integer.parseInt(parts[1]);
                    gravityY = Integer.parseInt(parts[2]);
                } else if (parts[0].equals("FLOOR")) {
                    floorY = Integer.parseInt(parts[1]);
                } else if (parts[0].equals("SPAWN")) {
                    SpawnEvent ev = new SpawnEvent();
                    ev.tick = Integer.parseInt(parts[1]);
                    ev.x = Integer.parseInt(parts[2]);
                    ev.y = Integer.parseInt(parts[3]);
                    ev.vx = Integer.parseInt(parts[4]);
                    ev.vy = Integer.parseInt(parts[5]);
                    ev.id = totalSpawned++;
                    spawns.add(ev);
                }
            }
            
            FileHandle outputFile = Gdx.files.absolute(outputPath);
            writer = new BufferedWriter(new OutputStreamWriter(outputFile.write(false), "UTF-8"));
            
            writer.write("TICKS " + totalTicks + "\n");
        } catch (Exception e) {
            e.printStackTrace();
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        if (currentTick >= totalTicks) {
            Gdx.app.exit();
            return;
        }

        try {
            for (SpawnEvent ev : spawns) {
                if (ev.tick == currentTick) {
                    Projectile p = pool.obtain();
                    p.id = ev.id;
                    p.position.set(ev.x, ev.y);
                    p.velocity.set(ev.vx, ev.vy);
                    activeProjectiles.add(p);
                }
            }

            activeProjectiles.sort(new Comparator<Projectile>() {
                @Override
                public int compare(Projectile p1, Projectile p2) {
                    return Integer.compare(p1.id, p2.id);
                }
            });

            if (activeProjectiles.size > peakActive) {
                peakActive = activeProjectiles.size;
            }

            Array<Projectile> groundedThisTick = new Array<>();

            for (int i = 0; i < activeProjectiles.size; i++) {
                Projectile p = activeProjectiles.get(i);
                p.velocity.add(gravityX, gravityY);
                p.position.add(p.velocity);
                
                if (p.position.y <= floorY) {
                    groundedThisTick.add(p);
                }
            }
            
            for (int i = 0; i < groundedThisTick.size; i++) {
                activeProjectiles.removeValue(groundedThisTick.get(i), true);
            }

            activeProjectiles.sort(new Comparator<Projectile>() {
                @Override
                public int compare(Projectile p1, Projectile p2) {
                    return Integer.compare(p1.id, p2.id);
                }
            });
            groundedThisTick.sort(new Comparator<Projectile>() {
                @Override
                public int compare(Projectile p1, Projectile p2) {
                    return Integer.compare(p1.id, p2.id);
                }
            });

            writer.write("TICK " + currentTick + " ACTIVE " + activeProjectiles.size + "\n");
            
            for (int i = 0; i < activeProjectiles.size; i++) {
                Projectile p = activeProjectiles.get(i);
                writer.write("P" + p.id + " x=" + (int)p.position.x + " y=" + (int)p.position.y + 
                             " vx=" + (int)p.velocity.x + " vy=" + (int)p.velocity.y + "\n");
            }

            for (int i = 0; i < groundedThisTick.size; i++) {
                Projectile p = groundedThisTick.get(i);
                writer.write("GROUNDED P" + p.id + " tick=" + currentTick + "\n");
                totalGrounded++;
                pool.free(p);
            }

            currentTick++;
            
            if (currentTick >= totalTicks) {
                Gdx.app.exit();
            }
        } catch (Exception e) {
            e.printStackTrace();
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        try {
            if (writer != null) {
                writer.write("SUMMARY spawned=" + totalSpawned + 
                             " grounded=" + totalGrounded + 
                             " pool_free=" + pool.getFree() + 
                             " peak_active=" + peakActive + "\n");
                writer.close();
            }
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            latch.countDown();
        }
    }
}
