package com.myproject;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Polygon;
import com.badlogic.gdx.math.Vector2;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

public class GeometryCli extends ApplicationAdapter {

    private static String scriptPath;
    private static final CountDownLatch latch = new CountDownLatch(1);

    private final Map<String, Polygon> polygons = new HashMap<>();
    private final Map<String, float[]> polygonVertices = new HashMap<>();

    @Override
    public void create() {
        try {
            processScript();
        } catch (Exception e) {
            System.err.println("Fatal error: " + e.getMessage());
        } finally {
            System.out.flush();
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        latch.countDown();
    }

    private void processScript() throws IOException {
        List<String> lines = Files.readAllLines(Paths.get(scriptPath));
        int lineNumber = 0;

        for (String line : lines) {
            lineNumber++;
            String trimmed = line.trim();

            // Skip blank lines and comments
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }

            try {
                processLine(trimmed, lineNumber);
            } catch (Exception e) {
                String[] tokens = trimmed.split("\\s+");
                String command = tokens.length > 0 ? tokens[0] : "UNKNOWN";
                System.out.println("ERROR " + lineNumber + " " + command);
            }
        }
    }

    private void processLine(String line, int lineNumber) {
        String[] tokens = line.split("\\s+");
        String command = tokens[0];

        switch (command) {
            case "POLY":
                handlePoly(tokens, lineNumber);
                break;
            case "OVERLAP":
                handleOverlap(tokens, lineNumber);
                break;
            case "CONTAINS":
                handleContains(tokens, lineNumber);
                break;
            case "SEGMENTS":
                handleSegments(tokens, lineNumber);
                break;
            case "AREA":
                handleArea(tokens, lineNumber);
                break;
            default:
                System.out.println("ERROR " + lineNumber + " " + command);
        }
    }

    private void handlePoly(String[] tokens, int lineNumber) {
        if (tokens.length < 7) {
            throw new IllegalArgumentException("POLY requires at least 3 vertices");
        }

        String name = tokens[1];
        int numCoords = tokens.length - 2;
        if (numCoords < 6 || numCoords % 2 != 0) {
            throw new IllegalArgumentException("POLY requires an even number of coordinates");
        }

        float[] vertices = new float[numCoords];
        try {
            for (int i = 0; i < numCoords; i++) {
                vertices[i] = Float.parseFloat(tokens[2 + i]);
            }
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid number format");
        }

        int vertexCount = numCoords / 2;
        Polygon poly = new Polygon(vertices);
        polygons.put(name, poly);
        polygonVertices.put(name, vertices);

        System.out.println("POLY " + name + " " + vertexCount);
    }

    private void handleOverlap(String[] tokens, int lineNumber) {
        if (tokens.length != 3) {
            throw new IllegalArgumentException("OVERLAP requires exactly 2 polygon names");
        }

        String nameA = tokens[1];
        String nameB = tokens[2];

        if (!polygons.containsKey(nameA)) {
            throw new IllegalArgumentException("Undefined polygon: " + nameA);
        }
        if (!polygons.containsKey(nameB)) {
            throw new IllegalArgumentException("Undefined polygon: " + nameB);
        }

        Polygon a = polygons.get(nameA);
        Polygon b = polygons.get(nameB);

        boolean result = Intersector.overlapConvexPolygons(a, b);
        System.out.println("OVERLAP " + nameA + " " + nameB + " " + result);
    }

    private void handleContains(String[] tokens, int lineNumber) {
        if (tokens.length != 4) {
            throw new IllegalArgumentException("CONTAINS requires name and x, y coordinates");
        }

        String name = tokens[1];

        if (!polygonVertices.containsKey(name)) {
            throw new IllegalArgumentException("Undefined polygon: " + name);
        }

        float x, y;
        try {
            x = Float.parseFloat(tokens[2]);
            y = Float.parseFloat(tokens[3]);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid number format");
        }

        float[] vertices = polygonVertices.get(name);
        boolean result = Intersector.isPointInPolygon(vertices, 0, vertices.length, x, y);

        // Preserve the input coordinate formatting
        System.out.println("CONTAINS " + name + " " + tokens[2] + " " + tokens[3] + " " + result);
    }

    private void handleSegments(String[] tokens, int lineNumber) {
        if (tokens.length != 9) {
            throw new IllegalArgumentException("SEGMENTS requires exactly 8 coordinates");
        }

        float ax, ay, bx, by, cx, cy, dx, dy;
        try {
            ax = Float.parseFloat(tokens[1]);
            ay = Float.parseFloat(tokens[2]);
            bx = Float.parseFloat(tokens[3]);
            by = Float.parseFloat(tokens[4]);
            cx = Float.parseFloat(tokens[5]);
            cy = Float.parseFloat(tokens[6]);
            dx = Float.parseFloat(tokens[7]);
            dy = Float.parseFloat(tokens[8]);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid number format");
        }

        Vector2 a = new Vector2(ax, ay);
        Vector2 b = new Vector2(bx, by);
        Vector2 c = new Vector2(cx, cy);
        Vector2 d = new Vector2(dx, dy);
        Vector2 intersection = new Vector2();

        boolean hit = Intersector.intersectSegments(a, b, c, d, intersection);

        if (hit) {
            System.out.println("SEGMENTS hit " + String.format(Locale.ROOT, "%.3f", intersection.x)
                    + " " + String.format(Locale.ROOT, "%.3f", intersection.y));
        } else {
            System.out.println("SEGMENTS miss");
        }
    }

    private void handleArea(String[] tokens, int lineNumber) {
        if (tokens.length != 2) {
            throw new IllegalArgumentException("AREA requires exactly 1 polygon name");
        }

        String name = tokens[1];

        if (!polygons.containsKey(name)) {
            throw new IllegalArgumentException("Undefined polygon: " + name);
        }

        Polygon poly = polygons.get(name);
        float area = poly.area();

        System.out.println("AREA " + name + " " + String.format(Locale.ROOT, "%.3f", area));
    }

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: GeometryCli <script-path>");
            System.exit(1);
        }

        scriptPath = args[0];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        new HeadlessApplication(new GeometryCli(), config);

        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}