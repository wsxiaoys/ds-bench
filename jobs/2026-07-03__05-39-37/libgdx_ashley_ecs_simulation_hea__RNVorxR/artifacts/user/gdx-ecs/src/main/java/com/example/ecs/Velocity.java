package com.example.ecs;

import com.badlogic.ashley.core.Component;
import com.badlogic.ashley.core.ComponentMapper;

public class Velocity implements Component {
    public static final ComponentMapper<Velocity> mapper = ComponentMapper.getFor(Velocity.class);

    public float x;
    public float y;

    public Velocity() {
    }

    public Velocity(float x, float y) {
        this.x = x;
        this.y = y;
    }
}