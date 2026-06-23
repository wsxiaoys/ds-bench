package projectile.sim;

import com.badlogic.gdx.files.FileHandle;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

final class Scenario {
    final int ticks;
    final int gravityX;
    final int gravityY;
    final int floorY;
    final List<Spawn> spawns;

    private Scenario(int ticks, int gravityX, int gravityY, int floorY, List<Spawn> spawns) {
        this.ticks = ticks;
        this.gravityX = gravityX;
        this.gravityY = gravityY;
        this.floorY = floorY;
        this.spawns = spawns;
    }

    static Scenario read(FileHandle file) {
        if (!file.exists()) {
            throw new IllegalArgumentException("Scenario file does not exist: " + file.path());
        }

        Integer ticks = null;
        Integer gravityX = null;
        Integer gravityY = null;
        Integer floorY = null;
        List<Spawn> spawns = new ArrayList<>();
        int nextId = 0;

        String[] lines = file.readString("UTF-8").split("\\R", -1);
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }

            String[] parts = line.split("\\s+");
            String directive = parts[0];
            switch (directive) {
                case "TICKS":
                    requirePartCount(parts, 2, i + 1);
                    if (ticks != null) {
                        throw new IllegalArgumentException("Duplicate TICKS directive at line " + (i + 1));
                    }
                    ticks = parseInt(parts[1], i + 1);
                    if (ticks < 0) {
                        throw new IllegalArgumentException("TICKS must be non-negative at line " + (i + 1));
                    }
                    break;
                case "GRAVITY":
                    requirePartCount(parts, 3, i + 1);
                    if (gravityX != null) {
                        throw new IllegalArgumentException("Duplicate GRAVITY directive at line " + (i + 1));
                    }
                    gravityX = parseInt(parts[1], i + 1);
                    gravityY = parseInt(parts[2], i + 1);
                    break;
                case "FLOOR":
                    requirePartCount(parts, 2, i + 1);
                    if (floorY != null) {
                        throw new IllegalArgumentException("Duplicate FLOOR directive at line " + (i + 1));
                    }
                    floorY = parseInt(parts[1], i + 1);
                    break;
                case "SPAWN":
                    requirePartCount(parts, 6, i + 1);
                    spawns.add(new Spawn(
                            nextId++,
                            parseInt(parts[1], i + 1),
                            parseInt(parts[2], i + 1),
                            parseInt(parts[3], i + 1),
                            parseInt(parts[4], i + 1),
                            parseInt(parts[5], i + 1)));
                    break;
                default:
                    throw new IllegalArgumentException("Unknown directive '" + directive + "' at line " + (i + 1));
            }
        }

        if (ticks == null) {
            throw new IllegalArgumentException("Missing required TICKS directive");
        }
        if (gravityX == null) {
            throw new IllegalArgumentException("Missing required GRAVITY directive");
        }
        if (floorY == null) {
            throw new IllegalArgumentException("Missing required FLOOR directive");
        }

        spawns.sort(Comparator.comparingInt((Spawn s) -> s.tick).thenComparingInt(s -> s.id));
        return new Scenario(ticks, gravityX, gravityY, floorY, Collections.unmodifiableList(spawns));
    }

    private static void requirePartCount(String[] parts, int expected, int lineNumber) {
        if (parts.length != expected) {
            throw new IllegalArgumentException(
                    "Expected " + expected + " tokens at line " + lineNumber + " but found " + parts.length);
        }
    }

    private static int parseInt(String value, int lineNumber) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid integer '" + value + "' at line " + lineNumber, e);
        }
    }

    static final class Spawn {
        final int id;
        final int tick;
        final int x;
        final int y;
        final int vx;
        final int vy;

        Spawn(int id, int tick, int x, int y, int vx, int vy) {
            this.id = id;
            this.tick = tick;
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
        }
    }
}
