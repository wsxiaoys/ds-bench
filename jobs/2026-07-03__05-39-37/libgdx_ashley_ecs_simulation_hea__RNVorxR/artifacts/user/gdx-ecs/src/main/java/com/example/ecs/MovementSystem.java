package com.example.ecs;

import com.badlogic.ashley.core.Engine;
import com.badlogic.ashley.core.Entity;
import com.badlogic.ashley.core.EntitySystem;
import com.badlogic.ashley.core.Family;
import com.badlogic.ashley.utils.ImmutableArray;

public class MovementSystem extends EntitySystem {

    private static final Family FAMILY = Family.all(Position.class, Velocity.class).get();

    private ImmutableArray<Entity> entities;

    public MovementSystem() {
        super();
    }

    @Override
    public void addedToEngine(Engine engine) {
        entities = engine.getEntitiesFor(FAMILY);
    }

    @Override
    public void removedFromEngine(Engine engine) {
        entities = null;
    }

    @Override
    public void update(float deltaTime) {
        if (entities == null) {
            return;
        }
        for (Entity entity : entities) {
            Position pos = Position.mapper.get(entity);
            Velocity vel = Velocity.mapper.get(entity);
            pos.x += vel.x * deltaTime;
            pos.y += vel.y * deltaTime;
        }
    }
}