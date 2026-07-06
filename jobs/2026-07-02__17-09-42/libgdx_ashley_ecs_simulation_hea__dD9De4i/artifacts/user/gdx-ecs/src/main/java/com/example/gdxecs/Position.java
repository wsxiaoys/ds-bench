package com.example.gdxecs;

import com.badlogic.ashley.core.Component;

/**
 * Position component: simply tracks an entity's world-space (x, y).
 * Mutated every engine tick by {@link MovementSystem}.
 */
public class Position implements Component {
    public float x;
    public float y;
}
