package com.example.gdxgame;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.math.Circle;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Rectangle;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

public class HeadlessListener extends ApplicationAdapter {

    private static final String ID_REGEX = "[A-Za-z0-9_-]+";

    private final String shapesPath;
    private final String outputPath;
    private final CountDownLatch latch;
    private final AtomicInteger exitCode;

    public HeadlessListener(String shapesPath, String outputPath,
                            CountDownLatch latch, AtomicInteger exitCode) {
        this.shapesPath = shapesPath;
        this.outputPath = outputPath;
        this.latch = latch;
        this.exitCode = exitCode;
    }

    @Override
    public void create() {
        int code = 1;
        try {
            process();
            code = 0;
        } catch (InvalidShapeLineException e) {
            System.err.println("Error: invalid shape line: " + e.getRawLine());
            code = 1;
        } catch (DuplicateIdException e) {
            System.err.println("Error: duplicate id " + e.getId());
            code = 1;
        } catch (Throwable t) {
            System.err.println("Error: " + t.getMessage());
            code = 1;
        } finally {
            exitCode.set(code);
            try {
                Gdx.app.exit();
            } catch (Throwable ignored) {
            }
            latch.countDown();
        }
    }

    private void process() throws IOException {
        FileHandle handle = Gdx.files.absolute(shapesPath);
        List<Shape> shapes = new ArrayList<>();
        Set<String> seenIds = new HashSet<>();

        try (BufferedReader reader = new BufferedReader(handle.reader())) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) {
                    continue;
                }
                if (trimmed.startsWith("#")) {
                    continue;
                }

                String[] tokens = trimmed.split("\\s+");
                if (tokens.length < 2) {
                    throw new InvalidShapeLineException(line);
                }

                String id = tokens[0];
                if (!id.matches(ID_REGEX)) {
                    throw new InvalidShapeLineException(line);
                }
                if (seenIds.contains(id)) {
                    throw new DuplicateIdException(id);
                }

                String shapeType = tokens[1];
                if ("rect".equals(shapeType)) {
                    if (tokens.length != 6) {
                        throw new InvalidShapeLineException(line);
                    }
                    float x = parseFloatOrFail(tokens[2], line);
                    float y = parseFloatOrFail(tokens[3], line);
                    float w = parseFloatOrFail(tokens[4], line);
                    float h = parseFloatOrFail(tokens[5], line);
                    if (!(w > 0) || !(h > 0)) {
                        throw new InvalidShapeLineException(line);
                    }
                    Rectangle rect = new Rectangle(x, y, w, h);
                    shapes.add(Shape.rect(id, rect));
                } else if ("circle".equals(shapeType)) {
                    if (tokens.length != 5) {
                        throw new InvalidShapeLineException(line);
                    }
                    float cx = parseFloatOrFail(tokens[2], line);
                    float cy = parseFloatOrFail(tokens[3], line);
                    float r = parseFloatOrFail(tokens[4], line);
                    if (!(r > 0)) {
                        throw new InvalidShapeLineException(line);
                    }
                    Circle circle = new Circle(cx, cy, r);
                    shapes.add(Shape.circle(id, circle));
                } else {
                    throw new InvalidShapeLineException(line);
                }

                seenIds.add(id);
            }
        }

        List<String[]> pairs = new ArrayList<>();
        int n = shapes.size();
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                Shape a = shapes.get(i);
                Shape b = shapes.get(j);
                if (overlaps(a, b)) {
                    String idA = a.id;
                    String idB = b.id;
                    if (idA.compareTo(idB) > 0) {
                        String tmp = idA;
                        idA = idB;
                        idB = tmp;
                    }
                    pairs.add(new String[]{idA, idB});
                }
            }
        }

        pairs.sort((p, q) -> {
            int cmp = p[0].compareTo(q[0]);
            if (cmp != 0) return cmp;
            return p[1].compareTo(q[1]);
        });

        StringBuilder sb = new StringBuilder();
        for (String[] pair : pairs) {
            sb.append(pair[0]).append('\t').append(pair[1]).append('\n');
        }
        sb.append("total_overlaps=").append(pairs.size()).append('\n');

        Files.write(Paths.get(outputPath), sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static float parseFloatOrFail(String token, String rawLine) {
        try {
            return Float.parseFloat(token);
        } catch (NumberFormatException e) {
            throw new InvalidShapeLineException(rawLine);
        }
    }

    private static boolean overlaps(Shape a, Shape b) {
        if (a.isCircle && b.isCircle) {
            return a.circle.overlaps(b.circle);
        }
        if (!a.isCircle && !b.isCircle) {
            return a.rect.overlaps(b.rect);
        }
        Circle c = a.isCircle ? a.circle : b.circle;
        Rectangle r = a.isCircle ? b.rect : a.rect;
        return Intersector.overlaps(c, r);
    }

    private static final class Shape {
        final String id;
        final boolean isCircle;
        final Rectangle rect;
        final Circle circle;

        private Shape(String id, boolean isCircle, Rectangle rect, Circle circle) {
            this.id = id;
            this.isCircle = isCircle;
            this.rect = rect;
            this.circle = circle;
        }

        static Shape rect(String id, Rectangle rect) {
            return new Shape(id, false, rect, null);
        }

        static Shape circle(String id, Circle circle) {
            return new Shape(id, true, null, circle);
        }
    }

    private static final class InvalidShapeLineException extends RuntimeException {
        private final String rawLine;

        InvalidShapeLineException(String rawLine) {
            this.rawLine = rawLine;
        }

        String getRawLine() {
            return rawLine;
        }
    }

    private static final class DuplicateIdException extends RuntimeException {
        private final String id;

        DuplicateIdException(String id) {
            this.id = id;
        }

        String getId() {
            return id;
        }
    }
}
