package com.example.gdxgame;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.math.Circle;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Rectangle;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;

public final class HeadlessCollisionLauncher {
    private HeadlessCollisionLauncher() {
    }

    public static void main(String[] args) throws InterruptedException {
        LaunchArguments launchArguments;
        try {
            launchArguments = LaunchArguments.parse(args);
        } catch (IllegalArgumentException exception) {
            System.err.println(exception.getMessage());
            System.exit(1);
            return;
        }

        CountDownLatch finished = new CountDownLatch(1);
        CollisionApplication listener = new CollisionApplication(
                launchArguments.shapesPath(),
                launchArguments.outputPath(),
                finished
        );

        HeadlessApplicationConfiguration configuration = new HeadlessApplicationConfiguration();
        configuration.updatesPerSecond = 0;
        new HeadlessApplication(listener, configuration);

        finished.await();
        int exitCode = listener.exitCode();
        if (exitCode != 0) {
            System.exit(exitCode);
        }
    }

    private record LaunchArguments(String shapesPath, String outputPath) {
        private static LaunchArguments parse(String[] args) {
            String shapesPath = null;
            String outputPath = null;

            for (String arg : args) {
                if (arg.startsWith("--shapes=")) {
                    shapesPath = arg.substring("--shapes=".length());
                } else if (arg.startsWith("--output=")) {
                    outputPath = arg.substring("--output=".length());
                } else {
                    throw new IllegalArgumentException("Error: invalid argument " + arg);
                }
            }

            if (shapesPath == null || shapesPath.isBlank()) {
                throw new IllegalArgumentException("Error: missing --shapes=<path>");
            }
            if (outputPath == null || outputPath.isBlank()) {
                throw new IllegalArgumentException("Error: missing --output=<path>");
            }
            if (!shapesPath.startsWith("/")) {
                throw new IllegalArgumentException("Error: --shapes path must be absolute");
            }
            if (!outputPath.startsWith("/")) {
                throw new IllegalArgumentException("Error: --output path must be absolute");
            }

            return new LaunchArguments(shapesPath, outputPath);
        }
    }

    private static final class CollisionApplication extends ApplicationAdapter {
        private final String shapesPath;
        private final String outputPath;
        private final CountDownLatch finished;
        private volatile int exitCode;
        private boolean processed;

        private CollisionApplication(String shapesPath, String outputPath, CountDownLatch finished) {
            this.shapesPath = shapesPath;
            this.outputPath = outputPath;
            this.finished = finished;
            this.exitCode = 0;
        }

        @Override
        public void create() {
            runOnce();
        }

        @Override
        public void render() {
            if (!processed) {
                runOnce();
            }
        }

        @Override
        public void dispose() {
            finished.countDown();
        }

        int exitCode() {
            return exitCode;
        }

        private void runOnce() {
            processed = true;
            try {
                List<Shape> shapes = loadShapes(shapesPath);
                List<Pair> overlaps = findOverlaps(shapes);
                writeReport(outputPath, overlaps);
                exitCode = 0;
            } catch (ShapeInputException exception) {
                System.err.println(exception.getMessage());
                exitCode = 1;
            } catch (RuntimeException exception) {
                System.err.println("Error: " + exception.getMessage());
                exitCode = 1;
            } finally {
                Gdx.app.exit();
            }
        }

        private static List<Shape> loadShapes(String path) {
            FileHandle file = Gdx.files.absolute(path);
            String contents = file.readString(String.valueOf(StandardCharsets.UTF_8));
            String[] lines = contents.split("\\R", -1);
            List<Shape> shapes = new ArrayList<>();
            Set<String> ids = new HashSet<>();

            for (String rawLine : lines) {
                if (rawLine.isBlank() || rawLine.stripLeading().startsWith("#")) {
                    continue;
                }

                Shape shape = parseShape(rawLine);
                if (!ids.add(shape.id())) {
                    throw new ShapeInputException("Error: duplicate id " + shape.id());
                }
                shapes.add(shape);
            }

            return shapes;
        }

        private static Shape parseShape(String rawLine) {
            String[] tokens = rawLine.trim().split("\\s+");
            if (tokens.length < 2 || !tokens[0].matches("[A-Za-z0-9_-]+")) {
                throw invalidShapeLine(rawLine);
            }

            try {
                return switch (tokens[1]) {
                    case "rect" -> parseRectangle(tokens, rawLine);
                    case "circle" -> parseCircle(tokens, rawLine);
                    default -> throw invalidShapeLine(rawLine);
                };
            } catch (NumberFormatException exception) {
                throw invalidShapeLine(rawLine);
            }
        }

        private static Shape parseRectangle(String[] tokens, String rawLine) {
            if (tokens.length != 6) {
                throw invalidShapeLine(rawLine);
            }

            float x = Float.parseFloat(tokens[2]);
            float y = Float.parseFloat(tokens[3]);
            float width = Float.parseFloat(tokens[4]);
            float height = Float.parseFloat(tokens[5]);
            if (!areFinite(x, y, width, height) || width <= 0.0f || height <= 0.0f) {
                throw invalidShapeLine(rawLine);
            }

            return new RectShape(tokens[0], new Rectangle(x, y, width, height));
        }

        private static Shape parseCircle(String[] tokens, String rawLine) {
            if (tokens.length != 5) {
                throw invalidShapeLine(rawLine);
            }

            float x = Float.parseFloat(tokens[2]);
            float y = Float.parseFloat(tokens[3]);
            float radius = Float.parseFloat(tokens[4]);
            if (!areFinite(x, y, radius) || radius <= 0.0f) {
                throw invalidShapeLine(rawLine);
            }

            return new CircleShape(tokens[0], new Circle(x, y, radius));
        }

        private static boolean areFinite(float... values) {
            for (float value : values) {
                if (!Float.isFinite(value)) {
                    return false;
                }
            }
            return true;
        }

        private static ShapeInputException invalidShapeLine(String rawLine) {
            return new ShapeInputException("Error: invalid shape line: " + rawLine);
        }

        private static List<Pair> findOverlaps(List<Shape> shapes) {
            List<Pair> overlaps = new ArrayList<>();
            for (int i = 0; i < shapes.size(); i++) {
                for (int j = i + 1; j < shapes.size(); j++) {
                    Shape first = shapes.get(i);
                    Shape second = shapes.get(j);
                    if (first.overlaps(second)) {
                        overlaps.add(Pair.of(first.id(), second.id()));
                    }
                }
            }
            overlaps.sort(Pair::compareTo);
            return overlaps;
        }

        private static void writeReport(String path, List<Pair> overlaps) {
            StringBuilder report = new StringBuilder();
            for (Pair pair : overlaps) {
                report.append(pair.first()).append('\t').append(pair.second()).append('\n');
            }
            report.append("total_overlaps=").append(overlaps.size()).append('\n');
            Gdx.files.absolute(path).writeString(report.toString(), false, String.valueOf(StandardCharsets.UTF_8));
        }
    }

    private sealed interface Shape permits RectShape, CircleShape {
        String id();

        boolean overlaps(Shape other);
    }

    private record RectShape(String id, Rectangle rectangle) implements Shape {
        @Override
        public boolean overlaps(Shape other) {
            if (other instanceof RectShape rectShape) {
                return rectangle.overlaps(rectShape.rectangle());
            }
            if (other instanceof CircleShape circleShape) {
                return Intersector.overlaps(circleShape.circle(), rectangle);
            }
            throw new IllegalArgumentException("unknown shape type");
        }
    }

    private record CircleShape(String id, Circle circle) implements Shape {
        @Override
        public boolean overlaps(Shape other) {
            if (other instanceof CircleShape circleShape) {
                return circle.overlaps(circleShape.circle());
            }
            if (other instanceof RectShape rectShape) {
                return Intersector.overlaps(circle, rectShape.rectangle());
            }
            throw new IllegalArgumentException("unknown shape type");
        }
    }

    private record Pair(String first, String second) implements Comparable<Pair> {
        private static Pair of(String left, String right) {
            if (left.compareTo(right) <= 0) {
                return new Pair(left, right);
            }
            return new Pair(right, left);
        }

        @Override
        public int compareTo(Pair other) {
            int firstComparison = first.compareTo(other.first);
            if (firstComparison != 0) {
                return firstComparison;
            }
            return second.compareTo(other.second);
        }
    }

    private static final class ShapeInputException extends RuntimeException {
        private ShapeInputException(String message) {
            super(message);
        }
    }
}
