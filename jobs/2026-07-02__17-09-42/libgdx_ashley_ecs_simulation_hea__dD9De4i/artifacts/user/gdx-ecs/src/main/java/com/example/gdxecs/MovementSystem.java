package com.example.gdxecs;

import com.badlogic.ashley.core.ComponentMapper;
import com.badlogic.ashley.core.Entity;
import com.badlogic.ashley.core.Family;
import com.badlogic.ashley.systems.IteratingSystem;

/**
 * Advances every entity with Position+Velocity by {@code position += velocity * dt}
 * on each {@link com.badlogic.ashley.core.Engine#update(float)} tick.
 *
 * Registered with default priority (0) on the engine in {@link Main.SimListener#create()}.
 */
public class MovementSystem extends IteratingSystem {

    private static final Family FAMILY = Family.all(Position.class, Velocity.class).get();

    private final ComponentMapper<Position> pm;
    private final ComponentMapper<Velocity> vm;

    @SuppressWarnings("unchecked")
    public MovementSystem() {
        super(FAMILY);
        this.pm = ComponentMapper.getFor(Position.class);
        this.vm = ComponentMapper.getFor(Velocity.class);
    }

    @Override
    protected void processEntity(Entity entity, float deltaTime) {
        Position p = pm.get(entity);
        Velocity v = vm.get(entity);
        p.x += v.x * deltaTime;
        p.y += v.y * deltaTime;
    }
}
