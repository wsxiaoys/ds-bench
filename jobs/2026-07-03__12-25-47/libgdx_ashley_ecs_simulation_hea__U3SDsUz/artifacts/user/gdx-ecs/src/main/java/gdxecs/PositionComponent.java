package gdxecs;

import com.badlogic.ashley.core.Component;

/** A simple position component carrying x and y coordinates. */
public class PositionComponent implements Component {
    public float x;
    public float y;

    public PositionComponent(float x, float y) {
        this.x = x;
        this.y = y;
    }
}
