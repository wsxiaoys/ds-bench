package com.gdxgame;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.Reader;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Parses the shape definition file into a list of {@link Shape} objects.
 *
 * <p>Validation rules:
 * <ul>
 *   <li>Lines starting with '#' are comments and are skipped.</li>
 *   <li>Blank/whitespace-only lines are skipped.</li>
 *   <li>IDs must be unique; duplicate IDs cause an error.</li>
 *   <li>width, height, and radius must be strictly positive.</li>
 *   <li>Malformed lines cause an error with the raw line printed verbatim.</li>
 * </ul>
 */
public class ShapeParser {

    private ShapeParser() {
        // utility class
    }

    /**
     * Parses shapes from the given reader. On success, returns the parsed list.
     * On any parse error, throws {@link ParseException} with a message suitable
     * for stderr output.
     */
    public static List<Shape> parse(Reader reader) throws IOException, ParseException {
        List<Shape> shapes = new ArrayList<>();
        Set<String> seenIds = new HashSet<>();

        try (BufferedReader br = new BufferedReader(reader)) {
            String line;
            int lineNumber = 0;
            while ((line = br.readLine()) != null) {
                lineNumber++;

                // Skip comments and blank lines
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }

                String[] tokens = trimmed.split("\\s+");
                if (tokens.length < 2) {
                    throw new ParseException("Error: invalid shape line: " + line);
                }

                String id = tokens[0];
                String type = tokens[1];

                // Validate ID uniqueness
                if (!seenIds.add(id)) {
                    throw new ParseException("Error: duplicate id " + id);
                }

                Shape shape;
                switch (type) {
                    case "rect":
                        shape = parseRect(id, tokens, line);
                        break;
                    case "circle":
                        shape = parseCircle(id, tokens, line);
                        break;
                    default:
                        throw new ParseException("Error: invalid shape line: " + line);
                }

                shapes.add(shape);
            }
        }

        return shapes;
    }

    private static Shape parseRect(String id, String[] tokens, String rawLine) throws ParseException {
        // Expected: <id> rect <x> <y> <width> <height>  => 6 tokens
        if (tokens.length != 6) {
            throw new ParseException("Error: invalid shape line: " + rawLine);
        }
        try {
            float x = Float.parseFloat(tokens[2]);
            float y = Float.parseFloat(tokens[3]);
            float width = Float.parseFloat(tokens[4]);
            float height = Float.parseFloat(tokens[5]);

            if (width <= 0 || height <= 0) {
                throw new ParseException("Error: invalid shape line: " + rawLine);
            }

            return new Shape.Rect(id, x, y, width, height);
        } catch (NumberFormatException e) {
            throw new ParseException("Error: invalid shape line: " + rawLine);
        }
    }

    private static Shape parseCircle(String id, String[] tokens, String rawLine) throws ParseException {
        // Expected: <id> circle <x> <y> <radius>  => 5 tokens
        if (tokens.length != 5) {
            throw new ParseException("Error: invalid shape line: " + rawLine);
        }
        try {
            float x = Float.parseFloat(tokens[2]);
            float y = Float.parseFloat(tokens[3]);
            float radius = Float.parseFloat(tokens[4]);

            if (radius <= 0) {
                throw new ParseException("Error: invalid shape line: " + rawLine);
            }

            return new Shape.Circ(id, x, y, radius);
        } catch (NumberFormatException e) {
            throw new ParseException("Error: invalid shape line: " + rawLine);
        }
    }

    // -- Exception -----------------------------------------------------------

    public static final class ParseException extends Exception {
        public ParseException(String message) {
            super(message);
        }
    }
}
