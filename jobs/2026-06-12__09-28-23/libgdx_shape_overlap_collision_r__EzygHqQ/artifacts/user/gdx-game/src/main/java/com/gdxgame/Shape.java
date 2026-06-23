package com.gdxgame;

import com.badlogic.gdx.math.Circle;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Rectangle;

/**
 * Immutable representation of a 2D shape (rectangle or circle) with an ID.
 * Uses libGDX geometry primitives for overlap detection.
 */
public abstract class Shape {

    private final String id;

    private Shape(String id) {
        this.id = id;
    }

    public String getId() {
        return id;
    }

    public abstract boolean overlaps(Shape other);

    // -- Rectangle -----------------------------------------------------------

    public static final class Rect extends Shape {
        private final Rectangle rect;

        public Rect(String id, float x, float y, float width, float height) {
            super(id);
            this.rect = new Rectangle(x, y, width, height);
        }

        @Override
        public boolean overlaps(Shape other) {
            if (other instanceof Rect) {
                return this.rect.overlaps(((Rect) other).rect);
            } else if (other instanceof Circ) {
                return Intersector.overlaps(((Circ) other).circle, this.rect);
            }
            return false;
        }
    }

    // -- Circle --------------------------------------------------------------

    public static final class Circ extends Shape {
        private final Circle circle;

        public Circ(String id, float x, float y, float radius) {
            super(id);
            this.circle = new Circle(x, y, radius);
        }

        @Override
        public boolean overlaps(Shape other) {
            if (other instanceof Circ) {
                return this.circle.overlaps(((Circ) other).circle);
            } else if (other instanceof Rect) {
                return Intersector.overlaps(this.circle, ((Rect) other).rect);
            }
            return false;
        }
    }
}
