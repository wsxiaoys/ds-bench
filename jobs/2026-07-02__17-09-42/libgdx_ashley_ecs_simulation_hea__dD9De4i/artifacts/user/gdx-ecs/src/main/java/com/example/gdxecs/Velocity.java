package com.example.gdxecs;

import com.badlogic.ashley.core.Component;

/**
 * Velocity component: per-tick (x, y) delta in world units / second.
 */
public class Velocity implements Component {
    public float x;
    public float y;
}
