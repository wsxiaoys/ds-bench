package com.gdxecs;

import com.badlogic.ashley.core.Component;

public class Position implements Component {
    public float x;
    public float y;

    public Position(float x, float y) {
        this.x = x;
        this.y = y;
    }
}
