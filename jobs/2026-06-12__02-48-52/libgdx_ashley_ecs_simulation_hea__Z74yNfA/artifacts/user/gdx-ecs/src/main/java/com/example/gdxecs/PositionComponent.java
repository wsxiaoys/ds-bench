package com.example.gdxecs;

import com.badlogic.ashley.core.Component;

/**
 * Ashley Component that stores an entity's 2-D world position.
 */
public class PositionComponent implements Component {
    public float x;
    public float y;

    public PositionComponent(float x, float y) {
        this.x = x;
        this.y = y;
    }
}
