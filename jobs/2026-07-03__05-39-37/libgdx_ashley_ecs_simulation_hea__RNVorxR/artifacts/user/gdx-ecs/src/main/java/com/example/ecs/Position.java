package com.example.ecs;

import com.badlogic.ashley.core.Component;
import com.badlogic.ashley.core.ComponentMapper;

public class Position implements Component {
    public static final ComponentMapper<Position> mapper = ComponentMapper.getFor(Position.class);

    public float x;
    public float y;

    public Position() {
    }

    public Position(float x, float y) {
        this.x = x;
        this.y = y;
    }
}