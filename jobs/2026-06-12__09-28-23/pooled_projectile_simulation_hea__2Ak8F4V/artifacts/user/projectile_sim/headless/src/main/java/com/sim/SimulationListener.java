package com.sim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.Pool;

import java.io.*;
import java.util.*;

public class SimulationListener extends ApplicationAdapter {

    private final String scenarioPath;
    private final String outputPath;

    // Scenario data
    private int totalTicks;
    private int gravityX;
    private int gravityY;
    private int floorY;
    private final List<SpawnDirective> spawns = new ArrayList<>();

    // Runtime state
    private int currentTick;
    private int nextSpawnIndex;
    private int totalSpawned;
    private int totalGrounded;
    private int peakActive;
    private boolean done;
    private final List<Projectile> active = new ArrayList<>();
    private final Pool<Projectile> pool = new Pool<Projectile>() {
        @Override
        protected Projectile newObject() {
            return new Projectile();
        }
    };

    private BufferedWriter writer;

    public SimulationListener(String scenarioPath, String outputPath) {
        this.scenarioPath = scenarioPath;
        this.outputPath = outputPath;
    }

    @Override
    public void create() {
        parseScenario();
        try {
            writer = new BufferedWriter(new OutputStreamWriter(
                    Gdx.files.absolute(outputPath).write(false), "UTF-8"));
        } catch (IOException e) {
            throw new RuntimeException("Failed to open output file: " + outputPath, e);
        }
        writeHeader();
    }

    @Override
    public void render() {
        if (done) {
            return;
        }

        if (currentTick >= totalTicks) {
            writeSummary();
            done = true;
            Gdx.app.exit();
            return;
        }

        // 1. Spawn projectiles scheduled for this tick
        while (nextSpawnIndex < spawns.size() && spawns.get(nextSpawnIndex).tick == currentTick) {
            SpawnDirective sd = spawns.get(nextSpawnIndex);
            Projectile p = pool.obtain();
            p.set(sd.id, sd.x, sd.y, sd.vx, sd.vy);
            active.add(p);
            totalSpawned++;
            nextSpawnIndex++;
        }

        // 2. Apply gravity and integrate
        for (Projectile p : active) {
            p.velocity.x += gravityX;
            p.velocity.y += gravityY;
            p.position.x += p.velocity.x;
            p.position.y += p.velocity.y;
        }

        // 3. Check grounding (after integration)
        List<Projectile> grounded = new ArrayList<>();
        Iterator<Projectile> it = active.iterator();
        while (it.hasNext()) {
            Projectile p = it.next();
            if (p.position.y <= floorY) {
                grounded.add(p);
                it.remove();
            }
        }

        // Sort grounded by spawn-id order
        grounded.sort(Comparator.comparingInt(a -> a.id));

        // Track peak
        if (active.size() > peakActive) {
            peakActive = active.size();
        }

        // Write tick output
        writeLine("TICK " + currentTick + " ACTIVE " + active.size());

        // Active projectiles at end of tick, in spawn-id order
        List<Projectile> sortedActive = new ArrayList<>(active);
        sortedActive.sort(Comparator.comparingInt(a -> a.id));
        for (Projectile p : sortedActive) {
            writeLine("P" + p.id + " x=" + (int) p.position.x + " y=" + (int) p.position.y
                    + " vx=" + (int) p.velocity.x + " vy=" + (int) p.velocity.y);
        }

        // Grounded projectiles
        for (Projectile p : grounded) {
            writeLine("GROUNDED P" + p.id + " tick=" + currentTick);
            pool.free(p);
            totalGrounded++;
        }

        currentTick++;
    }

    @Override
    public void dispose() {
        try {
            if (writer != null) {
                writer.close();
            }
        } catch (IOException ignored) {
        }
    }

    private void parseScenario() {
        FileHandle fh = Gdx.files.absolute(scenarioPath);
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(fh.read(), "UTF-8"))) {
            String line;
            int spawnIdCounter = 0;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                String[] parts = line.split("\\s+");
                switch (parts[0]) {
                    case "TICKS":
                        totalTicks = Integer.parseInt(parts[1]);
                        break;
                    case "GRAVITY":
                        gravityX = Integer.parseInt(parts[1]);
                        gravityY = Integer.parseInt(parts[2]);
                        break;
                    case "FLOOR":
                        floorY = Integer.parseInt(parts[1]);
                        break;
                    case "SPAWN":
                        int tick = Integer.parseInt(parts[1]);
                        int x = Integer.parseInt(parts[2]);
                        int y = Integer.parseInt(parts[3]);
                        int vx = Integer.parseInt(parts[4]);
                        int vy = Integer.parseInt(parts[5]);
                        spawns.add(new SpawnDirective(spawnIdCounter++, tick, x, y, vx, vy));
                        break;
                }
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to read scenario file: " + scenarioPath, e);
        }
    }

    private void writeHeader() {
        writeLine("TICKS " + totalTicks);
    }

    private void writeSummary() {
        writeLine("SUMMARY spawned=" + totalSpawned + " grounded=" + totalGrounded
                + " pool_free=" + pool.getFree() + " peak_active=" + peakActive);
    }

    private void writeLine(String s) {
        try {
            writer.write(s);
            writer.write('\n');
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private static class SpawnDirective {
        final int id;
        final int tick;
        final int x;
        final int y;
        final int vx;
        final int vy;

        SpawnDirective(int id, int tick, int x, int y, int vx, int vy) {
            this.id = id;
            this.tick = tick;
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
        }
    }
}
