package com.example.gdxecs;

import com.badlogic.ashley.core.Component;

/**
 * Ashley Component that stores an entity's 2-D velocity (units per second).
 */
public class VelocityComponent implements Component {
    public float x;
    public float y;

    public VelocityComponent(float x, float y) {
        this.x = x;
        this.y = y;
    }
}
