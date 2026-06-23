package com.gdxecs;

import com.badlogic.ashley.core.Component;

public class Velocity implements Component {
    public float x;
    public float y;

    public Velocity(float x, float y) {
        this.x = x;
        this.y = y;
    }
}
