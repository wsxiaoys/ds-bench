package com.gdxgame;

import com.badlogic.gdx.math.Circle;
import com.badlogic.gdx.math.Rectangle;

/**
 * Holds a parsed shape - either a Rectangle or a Circle - along with its id.
 */
public class ShapeEntry {

    public enum Type { RECT, CIRCLE }

    public final String id;
    public final Type type;
    // Only one of these will be non-null depending on type
    public final Rectangle rect;
    public final Circle circle;

    public ShapeEntry(String id, Rectangle rect) {
        this.id = id;
        this.type = Type.RECT;
        this.rect = rect;
        this.circle = null;
    }

    public ShapeEntry(String id, Circle circle) {
        this.id = id;
        this.type = Type.CIRCLE;
        this.rect = null;
        this.circle = circle;
    }
}
