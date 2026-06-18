package com.gdxecs;

import com.badlogic.ashley.core.Entity;
import com.badlogic.ashley.core.Family;
import com.badlogic.ashley.systems.IteratingSystem;
import com.badlogic.gdx.utils.Array;

public class MovementSystem extends IteratingSystem {

    @SuppressWarnings("unchecked")
    public MovementSystem() {
        super(Family.all(Position.class, Velocity.class).get());
    }

    @Override
    protected void processEntity(Entity entity, float deltaTime) {
        Position pos = entity.getComponent(Position.class);
        Velocity vel = entity.getComponent(Velocity.class);
        pos.x += vel.x * deltaTime;
        pos.y += vel.y * deltaTime;
    }
}
