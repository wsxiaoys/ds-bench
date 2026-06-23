package com.geometry.cli;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Polygon;
import com.badlogic.gdx.math.Vector2;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

public class GeometryCLI implements ApplicationListener {
    private final String scriptPath;
    private final CountDownLatch latch;

    public GeometryCLI(String scriptPath, CountDownLatch latch) {
        this.scriptPath = scriptPath;
        this.latch = latch;
    }

    @Override
    public void create() {
        try {
            processScript(scriptPath);
        } catch (Exception e) {
            System.err.println("Error processing script: " + e.getMessage());
        } finally {
            Gdx.app.exit();
        }
    }

    private void processScript(String path) {
        File file = new File(path);
        if (!file.exists()) {
            System.err.println("Script file not found: " + path);
            return;
        }

        Map<String, Polygon> polygons = new HashMap<>();

        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            int lineNumber = 0;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }

                String[] tokens = trimmed.split("\\s+");
                if (tokens.length == 0 || tokens[0].isEmpty()) {
                    continue;
                }

                String cmd = tokens[0];
                try {
                    switch (cmd) {
                        case "POLY":
                            handlePoly(tokens, polygons);
                            break;
                        case "OVERLAP":
                            handleOverlap(tokens, polygons);
                            break;
                        case "CONTAINS":
                            handleContains(tokens, polygons);
                            break;
                        case "SEGMENTS":
                            handleSegments(tokens);
                            break;
                        case "AREA":
                            handleArea(tokens, polygons);
                            break;
                        default:
                            throw new IllegalArgumentException(cmd);
                    }
                } catch (Exception e) {
                    System.out.println("ERROR " + lineNumber + " " + cmd);
                }
            }
        } catch (IOException e) {
            System.err.println("IO Error reading file: " + e.getMessage());
        }
    }

    private void handlePoly(String[] tokens, Map<String, Polygon> polygons) {
        if (tokens.length < 8 || tokens.length % 2 != 0) {
            throw new IllegalArgumentException("Invalid token count for POLY");
        }
        String name = tokens[1];
        if (!name.matches("[A-Za-z][A-Za-z0-9_]*")) {
            throw new IllegalArgumentException("Invalid polygon name: " + name);
        }

        float[] vertices = new float[tokens.length - 2];
        for (int i = 2; i < tokens.length; i++) {
            vertices[i - 2] = Float.parseFloat(tokens[i]);
        }

        Polygon polygon = new Polygon(vertices);
        polygons.put(name, polygon);

        System.out.println("POLY " + name + " " + (vertices.length / 2));
    }

    private void handleOverlap(String[] tokens, Map<String, Polygon> polygons) {
        if (tokens.length != 3) {
            throw new IllegalArgumentException("Invalid token count for OVERLAP");
        }
        String a = tokens[1];
        String b = tokens[2];

        Polygon polyA = polygons.get(a);
        Polygon polyB = polygons.get(b);

        if (polyA == null || polyB == null) {
            throw new IllegalArgumentException("Undefined polygon");
        }

        boolean overlap = Intersector.overlapConvexPolygons(polyA, polyB);
        System.out.println("OVERLAP " + a + " " + b + " " + overlap);
    }

    private void handleContains(String[] tokens, Map<String, Polygon> polygons) {
        if (tokens.length != 4) {
            throw new IllegalArgumentException("Invalid token count for CONTAINS");
        }
        String name = tokens[1];
        Polygon polygon = polygons.get(name);
        if (polygon == null) {
            throw new IllegalArgumentException("Undefined polygon");
        }

        float x = Float.parseFloat(tokens[2]);
        float y = Float.parseFloat(tokens[3]);

        float[] vertices = polygon.getVertices();
        boolean contains = Intersector.isPointInPolygon(vertices, 0, vertices.length, x, y);

        System.out.println("CONTAINS " + name + " " + tokens[2] + " " + tokens[3] + " " + contains);
    }

    private void handleSegments(String[] tokens) {
        if (tokens.length != 9) {
            throw new IllegalArgumentException("Invalid token count for SEGMENTS");
        }

        float ax = Float.parseFloat(tokens[1]);
        float ay = Float.parseFloat(tokens[2]);
        float bx = Float.parseFloat(tokens[3]);
        float by = Float.parseFloat(tokens[4]);
        float cx = Float.parseFloat(tokens[5]);
        float cy = Float.parseFloat(tokens[6]);
        float dx = Float.parseFloat(tokens[7]);
        float dy = Float.parseFloat(tokens[8]);

        Vector2 a = new Vector2(ax, ay);
        Vector2 b = new Vector2(bx, by);
        Vector2 c = new Vector2(cx, cy);
        Vector2 d = new Vector2(dx, dy);
        Vector2 intersection = new Vector2();

        boolean hit = Intersector.intersectSegments(a, b, c, d, intersection);
        if (hit) {
            String pxStr = String.format(Locale.ROOT, "%.3f", intersection.x);
            String pyStr = String.format(Locale.ROOT, "%.3f", intersection.y);
            System.out.println("SEGMENTS hit " + pxStr + " " + pyStr);
        } else {
            System.out.println("SEGMENTS miss");
        }
    }

    private void handleArea(String[] tokens, Map<String, Polygon> polygons) {
        if (tokens.length != 2) {
            throw new IllegalArgumentException("Invalid token count for AREA");
        }
        String name = tokens[1];
        Polygon polygon = polygons.get(name);
        if (polygon == null) {
            throw new IllegalArgumentException("Undefined polygon");
        }

        float area = polygon.area();
        String areaStr = String.format(Locale.ROOT, "%.3f", area);
        System.out.println("AREA " + name + " " + areaStr);
    }

    @Override
    public void resize(int width, int height) {}

    @Override
    public void render() {}

    @Override
    public void pause() {}

    @Override
    public void resume() {}

    @Override
    public void dispose() {
        latch.countDown();
    }

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: GeometryCLI <script-path>");
            System.exit(1);
        }

        String scriptPath = args[0];
        CountDownLatch latch = new CountDownLatch(1);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        try {
            new HeadlessApplication(new GeometryCLI(scriptPath, latch), config);
            latch.await();
        } catch (InterruptedException e) {
            System.err.println("Application interrupted: " + e.getMessage());
            Thread.currentThread().interrupt();
            System.exit(1);
        } catch (Exception e) {
            System.err.println("Failed to run application: " + e.getMessage());
            System.exit(1);
        }
    }
}
