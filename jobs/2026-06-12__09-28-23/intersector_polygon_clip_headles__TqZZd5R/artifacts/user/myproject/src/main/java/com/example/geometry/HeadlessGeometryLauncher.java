package com.example.geometry;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Polygon;
import com.badlogic.gdx.math.Vector2;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

public final class HeadlessGeometryLauncher {
    private HeadlessGeometryLauncher() {
    }

    public static void main(String[] args) throws InterruptedException {
        GeometryApplication listener = new GeometryApplication(args);
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        new HeadlessApplication(listener, config);
        listener.awaitApplicationThreadStarted();

        Thread applicationThread = listener.getApplicationThread();
        if (applicationThread != null) {
            applicationThread.join();
        }
    }

    private static final class GeometryApplication extends ApplicationAdapter {
        private final String[] args;
        private final Map<String, StoredPolygon> polygons = new HashMap<>();
        private final CountDownLatch applicationThreadStarted = new CountDownLatch(1);
        private volatile Thread applicationThread;

        private GeometryApplication(String[] args) {
            this.args = args.clone();
        }

        @Override
        public void create() {
            applicationThread = Thread.currentThread();
            applicationThreadStarted.countDown();

            try {
                if (args.length == 0) {
                    System.out.println("ERROR 0 missing-script");
                    return;
                }
                processScript(Path.of(args[0]));
            } finally {
                System.out.flush();
                Gdx.app.exit();
            }
        }

        private void awaitApplicationThreadStarted() throws InterruptedException {
            applicationThreadStarted.await();
        }

        private Thread getApplicationThread() {
            return applicationThread;
        }

        private void processScript(Path scriptPath) {
            try (BufferedReader reader = Files.newBufferedReader(scriptPath, StandardCharsets.UTF_8)) {
                String line;
                int lineNumber = 0;
                while ((line = reader.readLine()) != null) {
                    lineNumber++;
                    String trimmed = line.trim();
                    if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                        continue;
                    }
                    processLine(lineNumber, trimmed);
                }
            } catch (IOException | RuntimeException ex) {
                System.out.println("ERROR 0 script");
            }
        }

        private void processLine(int lineNumber, String line) {
            String[] tokens = line.split("\\s+");
            String command = tokens[0];

            try {
                switch (command) {
                    case "POLY" -> processPoly(lineNumber, tokens);
                    case "OVERLAP" -> processOverlap(lineNumber, tokens);
                    case "CONTAINS" -> processContains(lineNumber, tokens);
                    case "SEGMENTS" -> processSegments(lineNumber, tokens);
                    case "AREA" -> processArea(lineNumber, tokens);
                    default -> printError(lineNumber, command);
                }
            } catch (NumberFormatException ex) {
                printError(lineNumber, "number");
            } catch (IllegalArgumentException ex) {
                printError(lineNumber, ex.getMessage());
            }
        }

        private void processPoly(int lineNumber, String[] tokens) {
            if (tokens.length < 8 || ((tokens.length - 2) % 2) != 0) {
                printError(lineNumber, "POLY");
                return;
            }
            String name = tokens[1];
            if (!name.matches("[A-Za-z][A-Za-z0-9_]*")) {
                printError(lineNumber, "POLY");
                return;
            }

            float[] vertices = new float[tokens.length - 2];
            for (int i = 2; i < tokens.length; i++) {
                vertices[i - 2] = parseFloat(tokens[i]);
            }

            polygons.put(name, new StoredPolygon(vertices));
            System.out.println("POLY " + name + " " + (vertices.length / 2));
        }

        private void processOverlap(int lineNumber, String[] tokens) {
            if (tokens.length != 3) {
                printError(lineNumber, "OVERLAP");
                return;
            }
            StoredPolygon a = polygonOrThrow(tokens[1]);
            StoredPolygon b = polygonOrThrow(tokens[2]);
            boolean overlaps = Intersector.overlapConvexPolygons(a.polygon(), b.polygon());
            System.out.println("OVERLAP " + tokens[1] + " " + tokens[2] + " " + overlaps);
        }

        private void processContains(int lineNumber, String[] tokens) {
            if (tokens.length != 4) {
                printError(lineNumber, "CONTAINS");
                return;
            }
            StoredPolygon polygon = polygonOrThrow(tokens[1]);
            float x = parseFloat(tokens[2]);
            float y = parseFloat(tokens[3]);
            boolean contains = Intersector.isPointInPolygon(polygon.vertices(), 0, polygon.vertices().length, x, y);
            System.out.println("CONTAINS " + tokens[1] + " " + tokens[2] + " " + tokens[3] + " " + contains);
        }

        private void processSegments(int lineNumber, String[] tokens) {
            if (tokens.length != 9) {
                printError(lineNumber, "SEGMENTS");
                return;
            }
            Vector2 a = new Vector2(parseFloat(tokens[1]), parseFloat(tokens[2]));
            Vector2 b = new Vector2(parseFloat(tokens[3]), parseFloat(tokens[4]));
            Vector2 c = new Vector2(parseFloat(tokens[5]), parseFloat(tokens[6]));
            Vector2 d = new Vector2(parseFloat(tokens[7]), parseFloat(tokens[8]));
            Vector2 intersection = new Vector2();

            if (Intersector.intersectSegments(a, b, c, d, intersection)) {
                System.out.println(String.format(Locale.ROOT, "SEGMENTS hit %.3f %.3f", intersection.x, intersection.y));
            } else {
                System.out.println("SEGMENTS miss");
            }
        }

        private void processArea(int lineNumber, String[] tokens) {
            if (tokens.length != 2) {
                printError(lineNumber, "AREA");
                return;
            }
            StoredPolygon polygon = polygonOrThrow(tokens[1]);
            System.out.println(String.format(Locale.ROOT, "AREA %s %.3f", tokens[1], polygon.polygon().area()));
        }

        private float parseFloat(String token) {
            return Float.parseFloat(token);
        }

        private StoredPolygon polygonOrThrow(String name) {
            StoredPolygon polygon = polygons.get(name);
            if (polygon == null) {
                throw new IllegalArgumentException(name);
            }
            return polygon;
        }

        private void printError(int lineNumber, String reason) {
            System.out.println("ERROR " + lineNumber + " " + reason);
        }
    }

    private record StoredPolygon(float[] vertices, Polygon polygon) {
        private StoredPolygon(float[] vertices) {
            this(vertices, new Polygon(vertices.clone()));
        }
    }
}
