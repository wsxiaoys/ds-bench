package com.example.gdxgame;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.math.Circle;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Rectangle;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

public class CollisionListener extends ApplicationAdapter {
    private static final Pattern ID_PATTERN = Pattern.compile("[A-Za-z0-9_-]+");

    private final String shapesPath;
    private final String outputPath;

    public volatile boolean finished = false;
    public volatile int exitCode = 0;

    public CollisionListener(String shapesPath, String outputPath) {
        this.shapesPath = shapesPath;
        this.outputPath = outputPath;
    }

    @Override
    public void create() {
        try {
            process();
        } catch (Throwable t) {
            System.err.println("Error: " + t.getMessage());
            exitCode = 1;
        } finally {
            finished = true;
            Gdx.app.exit();
        }
    }

    private void process() throws IOException {
        FileHandle fh = Gdx.files.absolute(shapesPath);
        String content = fh.readString("UTF-8");
        String[] lines = content.split("\n", -1);

        // Strip trailing empty line caused by file ending with newline.
        List<String> rawLines = new ArrayList<>();
        for (String line : lines) {
            // Remove a single trailing \r for Windows-style line endings.
            if (!line.isEmpty() && line.charAt(line.length() - 1) == '\r') {
                line = line.substring(0, line.length() - 1);
            }
            rawLines.add(line);
        }

        // If the file ends with a newline, split introduces an empty trailing token - keep it for indexing
        // consistency but our iteration will skip blank lines anyway.

        List<Shape> shapes = new ArrayList<>();
        Map<String, Shape> byId = new HashMap<>();

        for (String raw : rawLines) {
            String trimmed = raw.trim();
            if (trimmed.isEmpty()) continue;
            if (trimmed.startsWith("#")) continue;

            Shape s;
            try {
                s = parseShape(raw);
            } catch (RuntimeException ex) {
                System.err.println("Error: invalid shape line: " + raw);
                exitCode = 1;
                return;
            }

            if (byId.containsKey(s.id)) {
                System.err.println("Error: duplicate id " + s.id);
                exitCode = 1;
                return;
            }
            byId.put(s.id, s);
            shapes.add(s);
        }

        List<String> overlaps = new ArrayList<>();
        int n = shapes.size();
        for (int i = 0; i < n; i++) {
            Shape a = shapes.get(i);
            for (int j = i + 1; j < n; j++) {
                Shape b = shapes.get(j);
                if (overlap(a, b)) {
                    String first = a.id.compareTo(b.id) <= 0 ? a.id : b.id;
                    String second = a.id.compareTo(b.id) <= 0 ? b.id : a.id;
                    overlaps.add(first + "\t" + second);
                }
            }
        }

        Collections.sort(overlaps);

        StringBuilder sb = new StringBuilder();
        for (String pair : overlaps) {
            sb.append(pair).append("\n");
        }
        sb.append("total_overlaps=").append(overlaps.size()).append("\n");

        // Write report to disk (overwrite if exists).
        Files.write(Paths.get(outputPath), sb.toString().getBytes(StandardCharsets.UTF_8),
                StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);
    }

    private Shape parseShape(String rawLine) {
        String[] tokens = rawLine.trim().split("\\s+");
        if (tokens.length < 2) {
            throw new RuntimeException("invalid");
        }
        String id = tokens[0];
        if (!ID_PATTERN.matcher(id).matches()) {
            throw new RuntimeException("invalid");
        }
        String type = tokens[1];
        if ("rect".equals(type)) {
            if (tokens.length != 6) throw new RuntimeException("invalid");
            float x = parseFloat(tokens[2]);
            float y = parseFloat(tokens[3]);
            float w = parseFloat(tokens[4]);
            float h = parseFloat(tokens[5]);
            if (!(w > 0f) || !(h > 0f)) throw new RuntimeException("invalid");
            Rectangle rect = new Rectangle(x, y, w, h);
            return new Shape(id, type, rect, null);
        } else if ("circle".equals(type)) {
            if (tokens.length != 5) throw new RuntimeException("invalid");
            float x = parseFloat(tokens[2]);
            float y = parseFloat(tokens[3]);
            float r = parseFloat(tokens[4]);
            if (!(r > 0f)) throw new RuntimeException("invalid");
            Circle circle = new Circle(x, y, r);
            return new Shape(id, type, null, circle);
        } else {
            throw new RuntimeException("invalid");
        }
    }

    private float parseFloat(String s) {
        try {
            return Float.parseFloat(s);
        } catch (NumberFormatException nfe) {
            throw new RuntimeException("invalid");
        }
    }

    private boolean overlap(Shape a, Shape b) {
        if ("rect".equals(a.type) && "rect".equals(b.type)) {
            return a.rectangle.overlaps(b.rectangle);
        } else if ("circle".equals(a.type) && "circle".equals(b.type)) {
            return a.circle.overlaps(b.circle);
        } else if ("circle".equals(a.type) && "rect".equals(b.type)) {
            return Intersector.overlaps(a.circle, b.rectangle);
        } else if ("rect".equals(a.type) && "circle".equals(b.type)) {
            return Intersector.overlaps(b.circle, a.rectangle);
        }
        return false;
    }

    private static class Shape {
        final String id;
        final String type;
        final Rectangle rectangle;
        final Circle circle;

        Shape(String id, String type, Rectangle rectangle, Circle circle) {
            this.id = id;
            this.type = type;
            this.rectangle = rectangle;
            this.circle = circle;
        }
    }
}
