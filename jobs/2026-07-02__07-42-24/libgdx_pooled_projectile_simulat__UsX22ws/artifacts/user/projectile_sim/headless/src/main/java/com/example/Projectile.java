package com.example;

import com.badlogic.gdx.math.Vector2;
import com.badlogic.gdx.utils.Pool.Poolable;

public class Projectile implements Poolable {
    public int id;
    public final Vector2 position = new Vector2();
    public final Vector2 velocity = new Vector2();

    public Projectile() {
        this.id = -1;
    }

    public void init(int id, float x, float y, float vx, float vy) {
        this.id = id;
        this.position.set(x, y);
        this.velocity.set(vx, vy);
    }

    @Override
    public void reset() {
        this.id = -1;
        this.position.set(0, 0);
        this.velocity.set(0, 0);
    }
}
