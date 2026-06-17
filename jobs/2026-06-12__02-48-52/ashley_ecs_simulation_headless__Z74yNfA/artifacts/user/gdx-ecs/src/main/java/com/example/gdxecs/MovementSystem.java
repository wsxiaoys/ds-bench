package com.example.gdxecs;

import com.badlogic.ashley.core.ComponentMapper;
import com.badlogic.ashley.core.Entity;
import com.badlogic.ashley.core.Family;
import com.badlogic.ashley.systems.IteratingSystem;

/**
 * Ashley EntitySystem that integrates position by velocity each tick.
 *
 * <p>For every entity that has both {@link PositionComponent} and
 * {@link VelocityComponent} it applies:
 * <pre>
 *   position.x += velocity.x * deltaTime
 *   position.y += velocity.y * deltaTime
 * </pre>
 */
public class MovementSystem extends IteratingSystem {

    private static final ComponentMapper<PositionComponent> PM =
            ComponentMapper.getFor(PositionComponent.class);

    private static final ComponentMapper<VelocityComponent> VM =
            ComponentMapper.getFor(VelocityComponent.class);

    public MovementSystem() {
        super(Family.all(PositionComponent.class, VelocityComponent.class).get(),
              /* priority */ 0);
    }

    @Override
    protected void processEntity(Entity entity, float deltaTime) {
        PositionComponent pos = PM.get(entity);
        VelocityComponent vel = VM.get(entity);
        pos.x += vel.x * deltaTime;
        pos.y += vel.y * deltaTime;
    }
}
