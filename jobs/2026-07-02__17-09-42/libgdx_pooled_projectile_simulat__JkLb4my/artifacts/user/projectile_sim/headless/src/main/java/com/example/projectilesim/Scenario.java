package com.example.projectilesim;

import com.badlogic.gdx.math.Vector2;

import java.util.ArrayList;
import java.util.List;

/**
 * In-memory representation of a parsed scenario file.
 *
 * <p>Once populated, the fields are read-only for the duration of the run.</p>
 */
public final class Scenario {

    /** Number of render() ticks to execute (parameter to {@code TICKS}). */
    public int ticks;

    /** Per-tick acceleration applied to every active projectile's velocity. */
    public final Vector2 gravity = new Vector2();

    /** Floor y-coordinate; projectiles with {@code y <= floorY} ground. */
    public int floorY;

    /**
     * All spawn directives in the order they appeared in the file.
     * Each spawn's id is its index in this list.
     */
    public final List<SpawnDirective> spawns = new ArrayList<>();

    /** A single SPAWN directive. */
    public static final class SpawnDirective {
        public final int tick;
        public final int x;
        public final int y;
        public final int vx;
        public final int vy;

        public SpawnDirective(int tick, int x, int y, int vx, int vy) {
            this.tick = tick;
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
        }
    }
}
