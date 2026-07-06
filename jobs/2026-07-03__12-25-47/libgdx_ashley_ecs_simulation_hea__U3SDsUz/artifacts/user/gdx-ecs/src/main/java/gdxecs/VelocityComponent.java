package gdxecs;

import com.badlogic.ashley.core.Component;

/** A simple velocity component carrying x and y components. */
public class VelocityComponent implements Component {
    public float x;
    public float y;

    public VelocityComponent(float x, float y) {
        this.x = x;
        this.y = y;
    }
}
