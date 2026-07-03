package com.example.projectilesim;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;

/**
 * Reader for scenario files.
 *
 * <p>Scenarios are UTF-8 text files containing one directive per line.
 * Lines starting with {@code #} (after trimming) and blank lines are
 * ignored.  Recognised directives are {@code TICKS}, {@code GRAVITY},
 * {@code FLOOR} and {@code SPAWN}.</p>
 */
public final class ScenarioParser {

    private ScenarioParser() {
        // utility class
    }

    /**
     * Read and parse the scenario file at {@code absolutePath} using
     * libGDX's file abstraction ({@link Gdx#files}) so that the simulation
     * exercises the same IO surface as any other libGDX application.
     */
    public static Scenario parse(String absolutePath) {
        FileHandle handle = Gdx.files.absolute(absolutePath);
        if (!handle.exists()) {
            throw new IllegalArgumentException(
                "Scenario file does not exist: " + absolutePath);
        }
        String text = handle.readString("UTF-8");
        return parseText(text, absolutePath);
    }

    /**
     * Pure parser variant.  Public-for-tests style: can be exercised with a
     * literal string without going through libGDX file IO.
     *
     * @param text          scenario body, UTF-8 decoded
     * @param sourceLabel   used solely for error messages
     */
    public static Scenario parseText(String text, String sourceLabel) {
        Scenario scenario = new Scenario();
        boolean hasTicks = false;
        boolean hasGravity = false;
        boolean hasFloor = false;

        String[] rawLines = text.split("\\r?\\n", -1);
        int lineNumber = 0;
        for (String raw : rawLines) {
            lineNumber++;
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            String[] tok = line.split("\\s+");
            if (tok.length == 0) {
                continue;
            }
            String head = tok[0];
            try {
                switch (head) {
                    case "TICKS": {
                        requireArity(tok, 2, "TICKS", sourceLabel, lineNumber);
                        scenario.ticks = parseInt(tok[1], "TICKS", sourceLabel, lineNumber);
                        hasTicks = true;
                        break;
                    }
                    case "GRAVITY": {
                        requireArity(tok, 3, "GRAVITY", sourceLabel, lineNumber);
                        int gx = parseInt(tok[1], "GRAVITY", sourceLabel, lineNumber);
                        int gy = parseInt(tok[2], "GRAVITY", sourceLabel, lineNumber);
                        scenario.gravity.set(gx, gy);
                        hasGravity = true;
                        break;
                    }
                    case "FLOOR": {
                        requireArity(tok, 2, "FLOOR", sourceLabel, lineNumber);
                        scenario.floorY = parseInt(tok[1], "FLOOR", sourceLabel, lineNumber);
                        hasFloor = true;
                        break;
                    }
                    case "SPAWN": {
                        requireArity(tok, 6, "SPAWN", sourceLabel, lineNumber);
                        int at = parseInt(tok[1], "SPAWN", sourceLabel, lineNumber);
                        int x = parseInt(tok[2], "SPAWN", sourceLabel, lineNumber);
                        int y = parseInt(tok[3], "SPAWN", sourceLabel, lineNumber);
                        int vx = parseInt(tok[4], "SPAWN", sourceLabel, lineNumber);
                        int vy = parseInt(tok[5], "SPAWN", sourceLabel, lineNumber);
                        scenario.spawns.add(
                            new Scenario.SpawnDirective(at, x, y, vx, vy));
                        break;
                    }
                    default:
                        throw new IllegalArgumentException(
                            "Unknown directive '" + head + "' in "
                                + sourceLabel + " at line " + lineNumber);
                }
            } catch (IllegalArgumentException ex) {
                // Preserve original cause but rewrite path/line for the user.
                throw new IllegalArgumentException(
                    ex.getMessage()
                        + " (in " + sourceLabel + " at line " + lineNumber + ")",
                    ex);
            }
        }

        if (!hasTicks) {
            throw new IllegalArgumentException(
                "Scenario is missing required TICKS directive: " + sourceLabel);
        }
        if (!hasGravity) {
            throw new IllegalArgumentException(
                "Scenario is missing required GRAVITY directive: " + sourceLabel);
        }
        if (!hasFloor) {
            throw new IllegalArgumentException(
                "Scenario is missing required FLOOR directive: " + sourceLabel);
        }
        return scenario;
    }

    private static void requireArity(String[] tok, int expected, String directive,
                                     String source, int line) {
        if (tok.length < expected) {
            throw new IllegalArgumentException(
                "Directive " + directive + " expects " + (expected - 1)
                    + " arguments");
        }
    }

    private static int parseInt(String s, String directive, String source, int line) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(
                "Invalid integer '" + s + "' for directive " + directive, ex);
        }
    }
}
