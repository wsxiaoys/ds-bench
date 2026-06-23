package com.example.gdxecs;

import com.badlogic.ashley.core.Component;

public final class PositionComponent implements Component {
    public float x;
    public float y;

    public PositionComponent(float x, float y) {
        this.x = x;
        this.y = y;
    }
}
