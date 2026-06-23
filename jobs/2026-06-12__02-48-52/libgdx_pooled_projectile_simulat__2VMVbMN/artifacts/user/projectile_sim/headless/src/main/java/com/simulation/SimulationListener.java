package com.simulation;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.Pool;

import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

/**
 * Drives the entire projectile-physics simulation inside a
 * {@link com.badlogic.gdx.backends.headless.HeadlessApplication}.
 *
 * <p>Lifecycle:
 * <ul>
 *   <li>{@link #create()} – parses the scenario file, opens the output writer,
 *       writes the header.</li>
 *   <li>{@link #render()} – called once per tick (fixed delta = 1). Spawns,
 *       integrates, grounds, and logs the tick. Calls {@link Gdx#app} {@code
 *       .exit()} after the last tick.</li>
 *   <li>{@link #dispose()} – flushes and closes the writer, then counts down
 *       the {@link CountDownLatch} so the launcher main thread can return.</li>
 * </ul>
 */
public class SimulationListener extends ApplicationAdapter {

    // -------------------------------------------------------------------------
    // Construction parameters (set before HeadlessApplication boots)
    // -------------------------------------------------------------------------

    private final String scenarioPath;
    private final String outputPath;
    private final CountDownLatch doneLatch;

    // -------------------------------------------------------------------------
    // Scenario data
    // -------------------------------------------------------------------------

    private int totalTicks;
    private int gravityX;
    private int gravityY;
    private int floorY;

    /**
     * Maps tick index → list of spawn descriptors.
     * Each descriptor is int[]{id, x, y, vx, vy}.
     */
    private Map<Integer, List<int[]>> spawnSchedule;
    private int totalSpawnCount;

    // -------------------------------------------------------------------------
    // Runtime state
    // -------------------------------------------------------------------------

    /** Recycles {@link Projectile} instances to avoid repeated allocation. */
    private Pool<Projectile> pool;

    /**
     * Projectiles that are currently in flight, kept in ascending
     * spawn-id order at all times.
     */
    private List<Projectile> activeProjectiles;

    private int currentTick;
    private int groundedCount;
    private int peakActive;

    // -------------------------------------------------------------------------
    // Output
    // -------------------------------------------------------------------------

    private PrintWriter writer;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    public SimulationListener(String scenarioPath, String outputPath,
                              CountDownLatch doneLatch) {
        this.scenarioPath = scenarioPath;
        this.outputPath   = outputPath;
        this.doneLatch    = doneLatch;
    }

    // -------------------------------------------------------------------------
    // ApplicationAdapter overrides
    // -------------------------------------------------------------------------

    @Override
    public void create() {
        spawnSchedule = new HashMap<>();
        parseScenario();

        // Build the pool; newObject() is called whenever the pool is exhausted.
        pool = new Pool<Projectile>() {
            @Override
            protected Projectile newObject() {
                return new Projectile();
            }
        };

        activeProjectiles = new ArrayList<>();
        currentTick   = 0;
        groundedCount = 0;
        peakActive    = 0;

        // Open the output file for writing.
        try {
            writer = new PrintWriter(new FileWriter(outputPath));
        } catch (IOException e) {
            throw new RuntimeException("Cannot open output file: " + outputPath, e);
        }

        // Header – echo the scenario's tick count.
        writer.print("TICKS " + totalTicks + "\n");
        writer.flush();
    }

    @Override
    public void render() {
        // Guard against spurious extra render() calls after exit was requested.
        if (currentTick >= totalTicks) {
            return;
        }

        final int t = currentTick;

        // ------------------------------------------------------------------
        // Step 1 – Spawn all projectiles scheduled for tick t.
        // ------------------------------------------------------------------
        List<int[]> spawns = spawnSchedule.getOrDefault(t, Collections.emptyList());
        for (int[] s : spawns) {
            // s = {id, x, y, vx, vy}
            Projectile p = pool.obtain();
            p.id = s[0];
            p.position.set(s[1], s[2]);
            p.velocity.set(s[3], s[4]);
            insertSortedById(p);
        }

        // Track peak AFTER spawning this tick (before any grounding).
        if (activeProjectiles.size() > peakActive) {
            peakActive = activeProjectiles.size();
        }

        // ------------------------------------------------------------------
        // Step 2 – Apply gravity then velocity (in spawn-id order, which is
        //          the order already maintained in activeProjectiles).
        // ------------------------------------------------------------------
        for (Projectile p : activeProjectiles) {
            p.velocity.x += gravityX;
            p.velocity.y += gravityY;
            p.position.x += p.velocity.x;
            p.position.y += p.velocity.y;
        }

        // ------------------------------------------------------------------
        // Step 3 – Detect grounded projectiles (y <= floor after integration).
        //          Collect them (already in id order) before removing.
        // ------------------------------------------------------------------
        List<Projectile> grounded = new ArrayList<>();
        Iterator<Projectile> iter = activeProjectiles.iterator();
        while (iter.hasNext()) {
            Projectile p = iter.next();
            if ((int) p.position.y <= floorY) {
                grounded.add(p);
                iter.remove();
            }
        }

        // ------------------------------------------------------------------
        // Output
        // ------------------------------------------------------------------

        // TICK line: count is the number still active AFTER grounding.
        writer.print("TICK " + t + " ACTIVE " + activeProjectiles.size() + "\n");

        // Active projectiles in ascending id order.
        for (Projectile p : activeProjectiles) {
            writer.print("P" + p.id
                    + " x="  + (int) p.position.x
                    + " y="  + (int) p.position.y
                    + " vx=" + (int) p.velocity.x
                    + " vy=" + (int) p.velocity.y
                    + "\n");
        }

        // Grounded projectiles in ascending id order, then free them.
        for (Projectile p : grounded) {
            writer.print("GROUNDED P" + p.id + " tick=" + t + "\n");
            groundedCount++;
            pool.free(p);   // resets the instance and puts it back in the pool
        }

        currentTick++;

        // ------------------------------------------------------------------
        // After the last tick: write the summary and request application exit.
        // ------------------------------------------------------------------
        if (currentTick >= totalTicks) {
            writer.print("SUMMARY"
                    + " spawned="     + totalSpawnCount
                    + " grounded="    + groundedCount
                    + " pool_free="   + pool.getFree()
                    + " peak_active=" + peakActive
                    + "\n");
            writer.flush();
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        if (writer != null) {
            writer.flush();
            writer.close();
            writer = null;
        }
        // Signal the launcher main thread that the simulation is fully done.
        doneLatch.countDown();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Parses the scenario file referenced by {@link #scenarioPath} using
     * {@code Gdx.files.absolute()} so the file is read through the libGDX
     * virtual-filesystem abstraction.
     */
    private void parseScenario() {
        FileHandle fh = Gdx.files.absolute(scenarioPath);
        String content = fh.readString("UTF-8");

        int spawnId = 0;
        for (String rawLine : content.split("\\r?\\n")) {
            String line = rawLine.trim();
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
                case "SPAWN": {
                    int tick = Integer.parseInt(parts[1]);
                    int x    = Integer.parseInt(parts[2]);
                    int y    = Integer.parseInt(parts[3]);
                    int vx   = Integer.parseInt(parts[4]);
                    int vy   = Integer.parseInt(parts[5]);
                    spawnSchedule
                        .computeIfAbsent(tick, k -> new ArrayList<>())
                        .add(new int[]{spawnId, x, y, vx, vy});
                    spawnId++;
                    totalSpawnCount++;
                    break;
                }
                default:
                    // Unknown directives are silently ignored.
                    break;
            }
        }
    }

    /**
     * Inserts {@code p} into {@link #activeProjectiles} such that the list
     * remains sorted in ascending spawn-id order.  Because ids are assigned in
     * parse order (monotonically increasing), newly spawned projectiles nearly
     * always append at the tail – but the full insertion-sort is kept for
     * correctness when multiple projectiles share the same tick.
     */
    private void insertSortedById(Projectile p) {
        int insertPos = activeProjectiles.size();
        while (insertPos > 0 && activeProjectiles.get(insertPos - 1).id > p.id) {
            insertPos--;
        }
        activeProjectiles.add(insertPos, p);
    }
}
