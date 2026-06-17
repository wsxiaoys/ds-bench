package com.example.gdxecs;

import java.util.List;

public final class Scenario {
    public final int ticks;
    public final List<EntitySpec> entities;

    public Scenario(int ticks, List<EntitySpec> entities) {
        this.ticks = ticks;
        this.entities = List.copyOf(entities);
    }

    public static final class EntitySpec {
        public final String id;
        public final float x;
        public final float y;
        public final float vx;
        public final float vy;

        public EntitySpec(String id, float x, float y, float vx, float vy) {
            this.id = id;
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
        }
    }
}
