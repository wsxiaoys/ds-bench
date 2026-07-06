package com.example.ecs;

import java.util.ArrayList;
import java.util.List;

/**
 * Parses a scenario file into a tick count and an ordered list of entity specs.
 */
public class Scenario {

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

    public final int ticks;
    public final List<EntitySpec> entities;

    public Scenario(int ticks, List<EntitySpec> entities) {
        this.ticks = ticks;
        this.entities = entities;
    }

    /**
     * Parse the scenario text. Lines starting with '#' and blank lines are ignored.
     * Exactly one TICKS line is expected; zero or more ENTITY lines follow in order.
     */
    public static Scenario parse(String content) {
        Integer ticks = null;
        List<EntitySpec> entities = new ArrayList<>();

        String[] lines = content.split("\n");
        for (String raw : lines) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            String[] tokens = line.split("\\s+");
            String keyword = tokens[0];

            if (keyword.equals("TICKS")) {
                if (tokens.length != 2) {
                    throw new IllegalArgumentException("Malformed TICKS line: " + raw);
                }
                int value;
                try {
                    value = Integer.parseInt(tokens[1]);
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("Invalid TICKS value: " + tokens[1], e);
                }
                if (value < 0) {
                    throw new IllegalArgumentException("TICKS must be non-negative: " + value);
                }
                ticks = value;
            } else if (keyword.equals("ENTITY")) {
                if (tokens.length != 6) {
                    throw new IllegalArgumentException("Malformed ENTITY line: " + raw);
                }
                String id = tokens[1];
                if (!id.matches("[A-Za-z0-9_]+")) {
                    throw new IllegalArgumentException("Invalid entity id: " + id);
                }
                float x = Float.parseFloat(tokens[2]);
                float y = Float.parseFloat(tokens[3]);
                float vx = Float.parseFloat(tokens[4]);
                float vy = Float.parseFloat(tokens[5]);
                entities.add(new EntitySpec(id, x, y, vx, vy));
            } else {
                throw new IllegalArgumentException("Unknown scenario keyword: " + keyword);
            }
        }

        if (ticks == null) {
            throw new IllegalArgumentException("Scenario file is missing a TICKS line");
        }
        return new Scenario(ticks, entities);
    }
}