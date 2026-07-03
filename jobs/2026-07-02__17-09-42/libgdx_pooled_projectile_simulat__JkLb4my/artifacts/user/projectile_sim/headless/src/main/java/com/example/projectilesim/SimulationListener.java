package com.example.projectilesim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.utils.Pool;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;

/**
 * Headless {@link com.badlogic.gdx.ApplicationListener} that drives the
 * deterministic projectile simulation.
 *
 * <p>The listener opens the scenario inside {@link #create()} (so
 * {@link com.badlogic.gdx.Gdx#files} is initialised), then advances the
 * simulation by exactly one tick per {@link #render()} call.  When the
 * requested tick count is reached, {@code Gdx.app.exit()} is invoked
 * which causes {@link com.badlogic.gdx.backends.headless.HeadlessApplication}
 * to dispose the listener and terminate cleanly.</p>
 */
public class SimulationListener extends ApplicationAdapter {

    /** Absolute path of the scenario file. */
    private final String scenarioPath;
    /** Absolute path of the output log file. */
    private final String outputPath;

    /** Pool of recycled {@link Projectile} instances. */
    private final Pool<Projectile> pool = new Pool<Projectile>() {
        @Override
        protected Projectile newObject() {
            return new Projectile();
        }
    };

    /** Active projectiles, kept sorted by ascending spawn id (order of obtain()). */
    private final List<Projectile> active = new ArrayList<>();

    /** Per-tick list of grounded projectile ids (cleared each tick after printing). */
    private final List<Integer> groundedThisTick = new ArrayList<>();

    /** Parsed scenario. */
    private Scenario scenario;

    /** Buffered writer to the output log.  Opened in create(), closed in dispose(). */
    private BufferedWriter writer;

    /** Counter used to assign spawn ids in SPAWN-file order. */
    private int nextSpawnId;

    /** Total projectiles spawned (one per SPAWN directive processed). */
    private int spawnedCount;

    /** Total projectiles grounded during the entire run. */
    private int groundedCount;

    /** Maximum active.size() observed across the entire run. */
    private int peakActive;

    /** Current tick.  First render() is tick 0. */
    private int currentTick;

    /**
     * Set once we have emitted the SUMMARY line.  Guarded against a
     * second render() invocation that some HeadlessApplication loops
     * perform after Gdx.app.exit() returns.
     */
    private volatile boolean summaryEmitted;

    /**
     * Latch decremented by {@link #dispose()}.  Launcher.main() awaits
     * this so the JVM cannot exit before the writer has been flushed.
     */
    private final CountDownLatch disposedLatch = new CountDownLatch(1);

    public SimulationListener(String scenarioPath, String outputPath) {
        this.scenarioPath = scenarioPath;
        this.outputPath = outputPath;
    }

    @Override
    public void create() {
        try {
            // 1. Open the output file before anything else so that any parse /
            //    IO error is reported into the log.
            Path out = Paths.get(outputPath);
            if (out.getParent() != null) {
                Files.createDirectories(out.getParent());
            }
            this.writer = Files.newBufferedWriter(out, StandardCharsets.UTF_8);

            // 2. Parse the scenario.
            this.scenario = ScenarioParser.parse(scenarioPath);

            // 3. Echo the header line.  The spec requires `TICKS <n>` as the
            //    first non-summary line of the output.
            writeLine("TICKS " + scenario.ticks);

            // Initial peak record (in case the scenario has zero spawns and
            // tick 0 is the only place we observe `active.size()`).
            if (active.size() > peakActive) {
                peakActive = active.size();
            }
        } catch (IOException ex) {
            throw new RuntimeException("Failed to initialise output: " + outputPath, ex);
        } catch (RuntimeException ex) {
            throw ex;
        }
    }

    @Override
    public void render() {
        // HeadlessApplication can invoke render() once more after
        // Gdx.app.exit() before its loop notices the exit request.  Return
        // early in that case so we don't produce duplicate output.
        if (summaryEmitted) {
            return;
        }
        // A single render() == a single tick.  The spec is explicit that
        // we must not derive the physics step from `Gdx.graphics.getDeltaTime()`.
        int t = currentTick;
        // When the requested TICKS is 0 (or render() is invoked one more
        // time after currentTick already passed scenario.ticks) we go
        // straight to the summary.  This also makes the launcher's count
        // of ticks deterministic.
        if (t >= scenario.ticks) {
            try {
                emitSummary();
                summaryEmitted = true;
                Gdx.app.exit();
            } catch (IOException ex) {
                throw new RuntimeException("Failed while writing summary", ex);
            }
            return;
        }
        try {
            // 1. Process every SPAWN scheduled for this tick, in file order.
            for (Scenario.SpawnDirective spawn : scenario.spawns) {
                if (spawn.tick != t) continue;
                Projectile p = pool.obtain();
                p.init(nextSpawnId, spawn.x, spawn.y, spawn.vx, spawn.vy);
                nextSpawnId++;
                spawnedCount++;
                active.add(p);
            }
            // After spawns, peak_active is potentially maximum for this tick.
            if (active.size() > peakActive) {
                peakActive = active.size();
            }

            // 2. Apply gravity and integrate for every active projectile,
            //    in ascending spawn-id order.
            for (Projectile p : active) {
                p.velocity.x += scenario.gravity.x;
                p.velocity.y += scenario.gravity.y;
                p.position.x += p.velocity.x;
                p.position.y += p.velocity.y;
            }

            // 3. Ground everything below the floor.  Iterate in reverse so
            //    removals don't disturb indices of items we still need to
            //    inspect.  Accumulate ids of grounded projectiles so we
            //    can print them in ascending order afterwards.
            groundedThisTick.clear();
            for (int i = active.size() - 1; i >= 0; i--) {
                Projectile p = active.get(i);
                if (p.position.y <= scenario.floorY) {
                    groundedThisTick.add(p.id);
                    active.remove(i);
                    pool.free(p);
                }
            }
            // Sort ascending to satisfy the spec's output order.
            groundedThisTick.sort(Integer::compare);

            // 4. Emit this tick's block.
            writeLine("TICK " + t + " ACTIVE " + active.size());
            for (Projectile p : active) {
                writeLine(formatProjectile(p));
            }
            for (Integer id : groundedThisTick) {
                writeLine("GROUNDED P" + id + " tick=" + t);
                groundedCount++;
            }

            // 5. Tick bookkeeping.
            currentTick++;
            if (currentTick >= scenario.ticks) {
                emitSummary();
                summaryEmitted = true;
                // Gdx.app.exit() schedules orderly shutdown; HeadlessApplication
                // will then call our dispose() and the JVM will exit once
                // the launcher main() has re-joined our thread.
                Gdx.app.exit();
            }
        } catch (IOException ex) {
            throw new RuntimeException("Failed while writing log at tick " + t, ex);
        }
    }

    @Override
    public void dispose() {
        if (writer != null) {
            try {
                // Emit a summary defensively if for any reason render()
                // never fired (e.g. TICKS 0).
                if (!summaryEmitted) {
                    writeLine("SUMMARY spawned=" + spawnedCount
                        + " grounded=" + groundedCount
                        + " pool_free=" + pool.getFree()
                        + " peak_active=" + peakActive);
                    summaryEmitted = true;
                }
                writer.flush();
                writer.close();
            } catch (IOException ex) {
                // Disposal is best-effort; the file may already be closed.
            } finally {
                writer = null;
            }
        }
        disposedLatch.countDown();
    }

    /** Used by Launcher.main() to block until dispose() has flushed the log. */
    public void awaitDisposed() throws InterruptedException {
        disposedLatch.await();
    }

    /** Append a single newline-terminated line to the log. */
    private void writeLine(String s) throws IOException {
        writer.write(s);
        writer.write('\n');
    }

    private String formatProjectile(Projectile p) {
        return "P" + p.id
            + " x=" + (int) p.position.x
            + " y=" + (int) p.position.y
            + " vx=" + (int) p.velocity.x
            + " vy=" + (int) p.velocity.y;
    }

    private void emitSummary() throws IOException {
        writeLine("SUMMARY spawned=" + spawnedCount
            + " grounded=" + groundedCount
            + " pool_free=" + pool.getFree()
            + " peak_active=" + peakActive);
    }
}
