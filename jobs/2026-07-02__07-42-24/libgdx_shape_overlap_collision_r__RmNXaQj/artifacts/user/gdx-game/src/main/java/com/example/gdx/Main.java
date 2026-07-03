package com.example.gdx;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.math.Circle;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Rectangle;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.OutputStreamWriter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

public class Main {
    private static final Pattern ID_PATTERN = Pattern.compile("^[a-zA-Z0-9_-]+$");

    public static class LauncherState {
        public volatile int exitCode = 0;
        public volatile Throwable exception = null;
    }

    public static void main(String[] args) {
        String shapesPath = null;
        String outputPath = null;
        for (String arg : args) {
            if (arg.startsWith("--shapes=")) {
                shapesPath = arg.substring("--shapes=".length());
            } else if (arg.startsWith("--output=")) {
                outputPath = arg.substring("--output=".length());
            } else {
                System.err.println("Error: Unknown argument: " + arg);
                System.exit(1);
            }
        }
        if (shapesPath == null || shapesPath.isEmpty()) {
            System.err.println("Error: Missing required argument: --shapes=<input_path>");
            System.exit(1);
        }
        if (outputPath == null || outputPath.isEmpty()) {
            System.err.println("Error: Missing required argument: --output=<output_path>");
            System.exit(1);
        }

        LauncherState state = new LauncherState();
        MyCollisionListener listener = new MyCollisionListener(shapesPath, outputPath, state);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        HeadlessApplication app = new HeadlessApplication(listener, config);

        // Wait for the headless loop thread to finish
        try {
            // Try reflection to get mainLoopThread
            java.lang.reflect.Field field = HeadlessApplication.class.getDeclaredField("mainLoopThread");
            field.setAccessible(true);
            Thread t = (Thread) field.get(app);
            if (t != null) {
                t.join();
            }
        } catch (Throwable ex) {
            // Fallback: find by name
            Thread headlessThread = null;
            for (Thread t : Thread.getAllStackTraces().keySet()) {
                if ("HeadlessApplication".equals(t.getName())) {
                    headlessThread = t;
                    break;
                }
            }
            if (headlessThread != null) {
                try {
                    headlessThread.join();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }

        System.exit(state.exitCode);
    }

    public static class MyCollisionListener extends ApplicationAdapter {
        private final String shapesPath;
        private final String outputPath;
        private final LauncherState launcherState;

        public MyCollisionListener(String shapesPath, String outputPath, LauncherState state) {
            this.shapesPath = shapesPath;
            this.outputPath = outputPath;
            this.launcherState = state;
        }

        @Override
        public void create() {
            try {
                runCollisionReport();
            } catch (Throwable t) {
                System.err.println("Error: Unexpected exception during execution");
                t.printStackTrace(System.err);
                launcherState.exitCode = 1;
                launcherState.exception = t;
            } finally {
                Gdx.app.exit();
            }
        }

        private void runCollisionReport() throws Exception {
            FileHandle fileHandle;
            try {
                fileHandle = Gdx.files.absolute(shapesPath);
            } catch (Exception e) {
                System.err.println("Error: Failed to access input file path: " + shapesPath);
                launcherState.exitCode = 1;
                return;
            }

            if (!fileHandle.exists()) {
                System.err.println("Error: input file does not exist: " + shapesPath);
                launcherState.exitCode = 1;
                return;
            }

            List<Shape> shapes = new ArrayList<>();
            Set<String> ids = new HashSet<>();

            try (BufferedReader reader = new BufferedReader(fileHandle.reader("UTF-8"))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    String trimmed = line.trim();
                    if (line.startsWith("#")) {
                        continue;
                    }
                    if (trimmed.isEmpty()) {
                        continue;
                    }

                    String[] tokens = trimmed.split("\\s+");
                    if (tokens.length < 2) {
                        System.err.println("Error: invalid shape line: " + line);
                        launcherState.exitCode = 1;
                        return;
                    }

                    String id = tokens[0];
                    if (!ID_PATTERN.matcher(id).matches()) {
                        System.err.println("Error: invalid shape line: " + line);
                        launcherState.exitCode = 1;
                        return;
                    }

                    if (ids.contains(id)) {
                        System.err.println("Error: duplicate id " + id);
                        launcherState.exitCode = 1;
                        return;
                    }

                    String type = tokens[1];
                    if ("rect".equals(type)) {
                        if (tokens.length != 6) {
                            System.err.println("Error: invalid shape line: " + line);
                            launcherState.exitCode = 1;
                            return;
                        }
                        float x, y, width, height;
                        try {
                            x = Float.parseFloat(tokens[2]);
                            y = Float.parseFloat(tokens[3]);
                            width = Float.parseFloat(tokens[4]);
                            height = Float.parseFloat(tokens[5]);
                        } catch (NumberFormatException e) {
                            System.err.println("Error: invalid shape line: " + line);
                            launcherState.exitCode = 1;
                            return;
                        }
                        if (width <= 0 || height <= 0 || Float.isNaN(x) || Float.isNaN(y) || Float.isNaN(width) || Float.isNaN(height)) {
                            System.err.println("Error: invalid shape line: " + line);
                            launcherState.exitCode = 1;
                            return;
                        }
                        shapes.add(new RectShape(id, x, y, width, height));
                    } else if ("circle".equals(type)) {
                        if (tokens.length != 5) {
                            System.err.println("Error: invalid shape line: " + line);
                            launcherState.exitCode = 1;
                            return;
                        }
                        float x, y, radius;
                        try {
                            x = Float.parseFloat(tokens[2]);
                            y = Float.parseFloat(tokens[3]);
                            radius = Float.parseFloat(tokens[4]);
                        } catch (NumberFormatException e) {
                            System.err.println("Error: invalid shape line: " + line);
                            launcherState.exitCode = 1;
                            return;
                        }
                        if (radius <= 0 || Float.isNaN(x) || Float.isNaN(y) || Float.isNaN(radius)) {
                            System.err.println("Error: invalid shape line: " + line);
                            launcherState.exitCode = 1;
                            return;
                        }
                        shapes.add(new CircleShape(id, x, y, radius));
                    } else {
                        System.err.println("Error: invalid shape line: " + line);
                        launcherState.exitCode = 1;
                        return;
                    }
                    ids.add(id);
                }
            }

            // Compute overlaps
            List<OverlapPair> overlaps = new ArrayList<>();
            for (int i = 0; i < shapes.size(); i++) {
                for (int j = i + 1; j < shapes.size(); j++) {
                    Shape s1 = shapes.get(i);
                    Shape s2 = shapes.get(j);
                    if (s1.overlaps(s2)) {
                        String idA = s1.id;
                        String idB = s2.id;
                        if (idA.compareTo(idB) > 0) {
                            String temp = idA;
                            idA = idB;
                            idB = temp;
                        }
                        overlaps.add(new OverlapPair(idA, idB));
                    }
                }
            }

            // Sort overlaps
            Collections.sort(overlaps, (p1, p2) -> {
                int cmp = p1.idA.compareTo(p2.idA);
                if (cmp != 0) {
                    return cmp;
                }
                return p1.idB.compareTo(p2.idB);
            });

            // Write output file
            FileHandle outputFileHandle;
            try {
                outputFileHandle = Gdx.files.absolute(outputPath);
            } catch (Exception e) {
                System.err.println("Error: Failed to access output file path: " + outputPath);
                launcherState.exitCode = 1;
                return;
            }

            try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(outputFileHandle.write(false), "UTF-8"))) {
                for (OverlapPair pair : overlaps) {
                    writer.write(pair.idA + "\t" + pair.idB);
                    writer.write("\n");
                }
                writer.write("total_overlaps=" + overlaps.size());
                writer.write("\n");
            } catch (Exception e) {
                System.err.println("Error: Failed to write output file: " + e.getMessage());
                launcherState.exitCode = 1;
                return;
            }

            launcherState.exitCode = 0;
        }
    }

    abstract static class Shape {
        final String id;
        Shape(String id) {
            this.id = id;
        }
        abstract boolean overlaps(Shape other);
    }

    static class RectShape extends Shape {
        final Rectangle rect;
        RectShape(String id, float x, float y, float width, float height) {
            super(id);
            this.rect = new Rectangle(x, y, width, height);
        }
        @Override
        boolean overlaps(Shape other) {
            if (other instanceof RectShape) {
                return this.rect.overlaps(((RectShape) other).rect);
            } else if (other instanceof CircleShape) {
                return Intersector.overlaps(((CircleShape) other).circle, this.rect);
            }
            return false;
        }
    }

    static class CircleShape extends Shape {
        final Circle circle;
        CircleShape(String id, float x, float y, float radius) {
            super(id);
            this.circle = new Circle(x, y, radius);
        }
        @Override
        boolean overlaps(Shape other) {
            if (other instanceof CircleShape) {
                return this.circle.overlaps(((CircleShape) other).circle);
            } else if (other instanceof RectShape) {
                return Intersector.overlaps(this.circle, ((RectShape) other).rect);
            }
            return false;
        }
    }

    static class OverlapPair {
        final String idA;
        final String idB;
        OverlapPair(String idA, String idB) {
            this.idA = idA;
            this.idB = idB;
        }
    }
}
