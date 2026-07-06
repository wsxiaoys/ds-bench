package com.example.gdxecs;

import com.badlogic.ashley.core.ComponentMapper;
import com.badlogic.ashley.core.Engine;
import com.badlogic.ashley.core.Entity;
import com.badlogic.ashley.core.PooledEngine;
import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Map;

/**
 * Entry point for the deterministic Ashley ECS simulation running on the libGDX headless backend.
 *
 * <p>Flow:
 * <ol>
 *   <li>{@link #main(String[])} boots a {@link HeadlessApplication} with {@code updatesPerSecond = 60}.</li>
 *   <li>The {@link SimListener} loads the scenario file, builds the engine and registers a
 *       {@link MovementSystem}.</li>
 *   <li>Every {@code render()} call advances the engine exactly once with the fixed delta
 *       {@code 1.0/60.0}; after exactly the configured number of ticks the listener prints the
 *       final state to stdout and asks the headless backend to exit.</li>
 *   <li>{@code main()} joins the headless main-loop thread before returning so the JVM does not
 *       shut down prematurely and stdout is reproducible.</li>
 * </ol>
 */
public final class Main {

    /** Fixed simulation step (60 Hz), independent of the headless {@code MockGraphics}. */
    private static final float FIXED_DT = 1.0f / 60.0f;

    /** Format used for every emitted numeric field. */
    private static final String FMT = "%.3f";

    private Main() {
        // utility
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("Usage: Main <scenario-file>");
            System.exit(2);
        }

        final String scenarioPath = args[0];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // The headless backend ticks render() at this rate; we use it as the *upper bound*,
        // but determinism comes from counting render() calls, not from this rate.
        config.updatesPerSecond = 60;

        SimListener listener = new SimListener(scenarioPath);

        HeadlessApplication app = new HeadlessApplication(listener, config);

        // The headless main loop runs on its own non-daemon thread (named "HeadlessApplication"
        // in libGDX's HeadlessApplication.java). Find it and block until it has finished, so we
        // don't return from main() before the SimListener has printed its output.
        Thread headlessThread = findHeadlessThread();
        if (headlessThread != null) {
            headlessThread.join();
        }
    }

    /**
     * Polls {@link Thread#getAllStackTraces()} for the headless main loop thread. We poll with a
     * short sleep because {@code new HeadlessApplication(...)} constructs the thread
     * asynchronously after the constructor returns; a brief grace period avoids a race.
     */
    private static Thread findHeadlessThread() throws InterruptedException {
        final long deadline = System.nanoTime() + 5_000_000_000L; // 5s safety bound
        while (System.nanoTime() < deadline) {
            for (Map.Entry<Thread, StackTraceElement[]> e : Thread.getAllStackTraces().entrySet()) {
                Thread t = e.getKey();
                String name = t.getName();
                if (name != null && name.equals("HeadlessApplication")) {
                    return t;
                }
            }
            Thread.sleep(5);
        }
        return null;
    }

    /**
     * The {@link ApplicationListener} that owns the {@link Engine} and drives the simulation.
     */
    private static final class SimListener implements ApplicationListener {

        private final String scenarioPath;
        private Engine engine;
        private final ArrayList<Entry> entries = new ArrayList<>();

        /** Number of ticks requested by the scenario's {@code TICKS} line. */
        private int targetTicks;
        /** Number of {@code render()} calls processed so far. */
        private int processedTicks;

        /** Set to true after we've written the final report and asked the backend to exit. */
        private boolean finished;

        SimListener(String scenarioPath) {
            this.scenarioPath = scenarioPath;
        }

        @Override
        public void create() {
            engine = new PooledEngine();
            engine.addSystem(new MovementSystem());

            FileHandle file = Gdx.files.absolute(scenarioPath);
            try (BufferedReader r = new BufferedReader(file.reader(8192, "UTF-8"))) {
                String line;
                while ((line = r.readLine()) != null) {
                    String trimmed = line.trim();
                    if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                        continue;
                    }
                    String[] parts = trimmed.split("\\s+");
                    if (parts.length == 0) {
                        continue;
                    }
                    switch (parts[0]) {
                        case "TICKS": {
                            if (parts.length < 2) {
                                throw new IllegalArgumentException("TICKS line missing count: " + trimmed);
                            }
                            targetTicks = Integer.parseInt(parts[1]);
                            if (targetTicks < 0) {
                                throw new IllegalArgumentException("TICKS must be non-negative: " + trimmed);
                            }
                            break;
                        }
                        case "ENTITY": {
                            if (parts.length < 6) {
                                throw new IllegalArgumentException("ENTITY line malformed: " + trimmed);
                            }
                            String id = parts[1];
                            if (!id.matches("[A-Za-z0-9_]+")) {
                                throw new IllegalArgumentException("Invalid entity id: " + id);
                            }
                            float x = Float.parseFloat(parts[2]);
                            float y = Float.parseFloat(parts[3]);
                            float vx = Float.parseFloat(parts[4]);
                            float vy = Float.parseFloat(parts[5]);

                            Entity e = engine.createEntity();
                            Position p = engine.createComponent(Position.class);
                            Velocity v = engine.createComponent(Velocity.class);
                            p.x = x;
                            p.y = y;
                            v.x = vx;
                            v.y = vy;
                            e.add(p);
                            e.add(v);
                            engine.addEntity(e);
                            entries.add(new Entry(id, e));
                            break;
                        }
                        default:
                            throw new IllegalArgumentException("Unknown directive: " + parts[0]);
                    }
                }
            } catch (IOException ex) {
                throw new RuntimeException("Failed to read scenario: " + scenarioPath, ex);
            }
        }

        @Override
        public void render() {
            if (finished) {
                return; // ignore further ticks after we've terminated
            }

            if (targetTicks == 0) {
                // No ticks requested: emit initial state and exit.
                finishAndExit();
                return;
            }

            if (processedTicks < targetTicks) {
                // One engine update == one logical tick of duration FIXED_DT seconds.
                engine.update(FIXED_DT);
                processedTicks++;

                if (processedTicks == targetTicks) {
                    finishAndExit();
                }
            }
        }

        /** Writes the final state to stdout and asks the headless backend to exit. */
        private void finishAndExit() {
            writeReport();
            finished = true;
            // Gdx.app.exit() schedules the headless main-loop's running-flag to flip via a posted
            // runnable; the loop then unwinds naturally on the HeadlessApplication thread.
            Gdx.app.exit();
        }

        private void writeReport() {
            StringBuilder out = new StringBuilder();
            out.append("TICK_COUNT ").append(targetTicks).append('\n');
            ComponentMapper<Position> pm = ComponentMapper.getFor(Position.class);
            for (Entry e : entries) {
                Position p = pm.get(e.entity);
                out.append("ENTITY ").append(e.id)
                        .append(" x=").append(String.format(Locale.ROOT, FMT, p.x))
                        .append(" y=").append(String.format(Locale.ROOT, FMT, p.y))
                        .append('\n');
            }
            // Single write so the output is flushed atomically before Gdx.app.exit() returns.
            System.out.print(out.toString());
            System.out.flush();
        }

        @Override
        public void resize(int width, int height) {
            // no-op: there is no surface on a headless backend.
        }

        @Override
        public void pause() {
            // no-op.
        }

        @Override
        public void resume() {
            // no-op.
        }

        @Override
        public void dispose() {
            // Engine cleanup is handled by GC; we don't hold any native resources in headless mode.
        }
    }

    /** Captures just enough info about an entity to emit its final position in input order. */
    private static final class Entry {
        final String id;
        final Entity entity;

        Entry(String id, Entity entity) {
            this.id = id;
            this.entity = entity;
        }
    }
}
