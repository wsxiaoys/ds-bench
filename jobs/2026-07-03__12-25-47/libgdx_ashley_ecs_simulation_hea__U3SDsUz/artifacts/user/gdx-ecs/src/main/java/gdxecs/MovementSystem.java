package gdxecs;

import com.badlogic.ashley.core.ComponentMapper;
import com.badlogic.ashley.core.Entity;
import com.badlogic.ashley.core.Family;
import com.badlogic.ashley.systems.IteratingSystem;

/**
 * Advances every entity that has both a {@link PositionComponent} and a
 * {@link VelocityComponent} by integrating the velocity over the supplied
 * delta time:  position += velocity * dt.
 */
public class MovementSystem extends IteratingSystem {

    @SuppressWarnings("unchecked")
    private static final Family FAMILY = Family.all(PositionComponent.class, VelocityComponent.class).get();

    private final ComponentMapper<PositionComponent> pm = ComponentMapper.getFor(PositionComponent.class);
    private final ComponentMapper<VelocityComponent> vm = ComponentMapper.getFor(VelocityComponent.class);

    public MovementSystem() {
        super(FAMILY);
    }

    @Override
    protected void processEntity(Entity entity, float deltaTime) {
        PositionComponent pos = pm.get(entity);
        VelocityComponent vel = vm.get(entity);
        pos.x += vel.x * deltaTime;
        pos.y += vel.y * deltaTime;
    }
}
