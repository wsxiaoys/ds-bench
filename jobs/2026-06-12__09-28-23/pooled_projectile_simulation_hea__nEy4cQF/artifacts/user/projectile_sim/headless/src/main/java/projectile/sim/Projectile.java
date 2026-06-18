package projectile.sim;

import com.badlogic.gdx.math.Vector2;
import com.badlogic.gdx.utils.Pool;

final class Projectile implements Pool.Poolable {
    int id;
    final Vector2 position = new Vector2();
    final Vector2 velocity = new Vector2();

    void initialize(int id, int x, int y, int vx, int vy) {
        this.id = id;
        this.position.set(x, y);
        this.velocity.set(vx, vy);
    }

    @Override
    public void reset() {
        id = -1;
        position.setZero();
        velocity.setZero();
    }
}
