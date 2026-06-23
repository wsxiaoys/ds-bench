package com.mygame.components;

import com.badlogic.ashley.core.Component;

public class VelocityComponent implements Component {
    public float x;
    public float y;

    public VelocityComponent() {}

    public VelocityComponent(float x, float y) {
        this.x = x;
        this.y = y;
    }
}
