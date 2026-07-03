package com.example.projectilesim;

import com.badlogic.gdx.math.Vector2;
import com.badlogic.gdx.utils.Pool;

/**
 * A single projectile participating in the simulation.
 *
 * <p>Instances of this class are recycled by a {@link Pool}&lt;Projectile&gt;,
 * so all mutable state must be initialised inside {@link #reset()} to keep
 * an {@link #obtain() obtained} instance deterministic regardless of how it
 * was previously used.</p>
 *
 * <p>The position and velocity are stored in libGDX {@link Vector2}
 * instances.  Although {@code Vector2} stores {@code float}s the
 * simulation only ever performs integer arithmetic on its components,
 * so values can be safely cast to {@code int} when emitting log lines.</p>
 */
public class Projectile implements Pool.Poolable {

    /** Spawn identifier: assigned in the order SPAWN lines appear in the scenario. */
    public int id = -1;

    /** Current integer position in scenario space. */
    public final Vector2 position = new Vector2();

    /** Current integer velocity in scenario space (units per tick). */
    public final Vector2 velocity = new Vector2();

    /**
     * Initialise this instance with the supplied id and integer state.
     *
     * @param id  unique spawn identifier
     * @param x   initial x position
     * @param y   initial y position
     * @param vx  initial x velocity (units/tick)
     * @param vy  initial y velocity (units/tick)
     */
    public void init(int id, int x, int y, int vx, int vy) {
        this.id = id;
        this.position.set(x, y);
        this.velocity.set(vx, vy);
    }

    /**
     * Reset every field to a known default.  Required by
     * {@link Pool.Poolable} and called every time the projectile is
     * returned to the pool via {@link Pool#free(Object)}.
     */
    @Override
    public void reset() {
        this.id = -1;
        this.position.set(0, 0);
        this.velocity.set(0, 0);
    }
}
