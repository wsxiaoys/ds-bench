package com.sim;

import com.badlogic.gdx.math.Vector2;
import com.badlogic.gdx.utils.Pool;

public class Projectile implements Pool.Poolable {
    public int id;
    public final Vector2 position = new Vector2();
    public final Vector2 velocity = new Vector2();

    public Projectile() {
    }

    public void set(int id, int x, int y, int vx, int vy) {
        this.id = id;
        this.position.set(x, y);
        this.velocity.set(vx, vy);
    }

    @Override
    public void reset() {
        id = 0;
        position.setZero();
        velocity.setZero();
    }
}
