package com.sim;

import com.badlogic.gdx.math.Vector2;
import com.badlogic.gdx.utils.Pool;

public class Projectile implements Pool.Poolable {
    public int id;
    public final Vector2 position = new Vector2();
    public final Vector2 velocity = new Vector2();

    @Override
    public void reset() {
        id = -1;
        position.set(0, 0);
        velocity.set(0, 0);
    }
}
