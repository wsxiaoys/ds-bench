package com.example.gdxecs;

import com.badlogic.gdx.Gdx;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public final class ScenarioParser {
    private static final Pattern ENTITY_ID = Pattern.compile("[A-Za-z0-9_]+");

    private ScenarioParser() {
    }

    public static Scenario parse(String path) {
        String content = Gdx.files.absolute(path).readString("UTF-8");
        String[] lines = content.split("\\R", -1);

        Integer ticks = null;
        List<Scenario.EntitySpec> entities = new ArrayList<>();

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }

            String[] parts = line.split("\\s+");
            if (parts.length == 2 && parts[0].equals("TICKS")) {
                if (ticks != null) {
                    throw new IllegalArgumentException("Duplicate TICKS line at " + (i + 1));
                }
                ticks = parseTicks(parts[1], i + 1);
            } else if (parts.length == 6 && parts[0].equals("ENTITY")) {
                String id = parts[1];
                if (!ENTITY_ID.matcher(id).matches()) {
                    throw new IllegalArgumentException("Invalid entity id at line " + (i + 1) + ": " + id);
                }
                entities.add(new Scenario.EntitySpec(
                        id,
                        parseFloat(parts[2], i + 1),
                        parseFloat(parts[3], i + 1),
                        parseFloat(parts[4], i + 1),
                        parseFloat(parts[5], i + 1)));
            } else {
                throw new IllegalArgumentException("Invalid scenario line " + (i + 1) + ": " + lines[i]);
            }
        }

        if (ticks == null) {
            throw new IllegalArgumentException("Scenario must contain exactly one TICKS line");
        }

        return new Scenario(ticks, entities);
    }

    private static int parseTicks(String value, int lineNumber) {
        try {
            long parsed = Long.parseLong(value);
            if (parsed < 0 || parsed > Integer.MAX_VALUE) {
                throw new IllegalArgumentException("TICKS out of range at line " + lineNumber + ": " + value);
            }
            return (int) parsed;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid TICKS value at line " + lineNumber + ": " + value, e);
        }
    }

    private static float parseFloat(String value, int lineNumber) {
        try {
            return Float.parseFloat(value);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid float at line " + lineNumber + ": " + value, e);
        }
    }
}
