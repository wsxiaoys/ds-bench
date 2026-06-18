package com.simulation;

import com.badlogic.gdx.math.Vector2;
import com.badlogic.gdx.utils.Pool;

/**
 * A single projectile whose mutable state is held in libGDX {@link Vector2}
 * instances. Implements {@link Pool.Poolable} so it can be recycled through a
 * {@link com.badlogic.gdx.utils.Pool} between simulations or within the same
 * simulation run.
 */
public class Projectile implements Pool.Poolable {

    /** Spawn-order identifier (assigned at construction time, cleared in reset). */
    public int id;

    /** World-space position (x, y) – components treated as integers. */
    public final Vector2 position;

    /** Current velocity (vx, vy) – components treated as integers. */
    public final Vector2 velocity;

    public Projectile() {
        position = new Vector2();
        velocity = new Vector2();
    }

    /**
     * Called by the pool when this instance is returned via
     * {@link com.badlogic.gdx.utils.Pool#free(Object)}. Resets all fields to
     * safe defaults so the next {@link com.badlogic.gdx.utils.Pool#obtain()}
     * call receives a clean object.
     */
    @Override
    public void reset() {
        id = 0;
        position.set(0f, 0f);
        velocity.set(0f, 0f);
    }
}
