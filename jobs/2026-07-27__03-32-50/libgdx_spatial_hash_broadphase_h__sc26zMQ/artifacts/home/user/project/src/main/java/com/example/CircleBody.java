package com.example;

import com.badlogic.gdx.math.Vector2;

/**
 * A single simulated circle: identity, position, velocity and radius.
 */
public class CircleBody {
    public int id;
    public final Vector2 pos = new Vector2();
    public final Vector2 vel = new Vector2();
    public float r;
}
