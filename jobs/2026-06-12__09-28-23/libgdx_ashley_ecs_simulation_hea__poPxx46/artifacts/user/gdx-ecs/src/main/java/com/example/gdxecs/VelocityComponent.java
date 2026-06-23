package com.example.gdxecs;

import com.badlogic.ashley.core.Component;

public final class VelocityComponent implements Component {
    public float x;
    public float y;

    public VelocityComponent(float x, float y) {
        this.x = x;
        this.y = y;
    }
}
