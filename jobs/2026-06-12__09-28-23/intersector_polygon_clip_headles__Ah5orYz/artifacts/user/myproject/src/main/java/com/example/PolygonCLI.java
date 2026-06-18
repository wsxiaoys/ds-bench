package com.example;

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

public class PolygonCLI extends ApplicationAdapter {

    private final String scriptPath;
    private final CountDownLatch done = new CountDownLatch(1);
    private final Map<String, Polygon> polygons = new HashMap<>();

    public PolygonCLI(String scriptPath) {
        this.scriptPath = scriptPath;
    }

    public void await() throws InterruptedException {
        done.await();
    }

    @Override
    public void create() {
        try {
            List<String> lines = Files.readAllLines(Paths.get(scriptPath));
            for (int i = 0; i < lines.size(); i++) {
                int lineNum = i + 1;
                String line = lines.get(i).trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                try {
                    processLine(line, lineNum);
                } catch (CLIError e) {
                    System.out.println("ERROR " + lineNum + " " + e.getMessage());
                }
            }
            System.out.flush();
        } catch (IOException e) {
            System.err.println("Failed to read script: " + e.getMessage());
        } finally {
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        done.countDown();
    }

    private void processLine(String line, int lineNum) throws CLIError {
        String[] tokens = line.split("\\s+");
        if (tokens.length == 0) {
            return;
        }
        String command = tokens[0].toUpperCase(Locale.ROOT);

        switch (command) {
            case "POLY":
                handlePoly(tokens, lineNum);
                break;
            case "OVERLAP":
                handleOverlap(tokens, lineNum);
                break;
            case "CONTAINS":
                handleContains(tokens, line, lineNum);
                break;
            case "SEGMENTS":
                handleSegments(tokens, lineNum);
                break;
            case "AREA":
                handleArea(tokens, lineNum);
                break;
            default:
                throw new CLIError(tokens[0]);
        }
    }

    private void handlePoly(String[] tokens, int lineNum) throws CLIError {
        // POLY <name> <x1> <y1> ... <xn> <yn>
        // Minimum: POLY name x1 y1 x2 y2 x3 y3 = 8 tokens
        if (tokens.length < 8 || (tokens.length - 2) % 2 != 0) {
            throw new CLIError("POLY");
        }
        String name = tokens[1];
        if (!name.matches("[A-Za-z][A-Za-z0-9_]*")) {
            throw new CLIError("POLY");
        }
        int vertexCount = (tokens.length - 2) / 2;
        if (vertexCount < 3) {
            throw new CLIError("POLY");
        }
        float[] vertices = new float[vertexCount * 2];
        for (int i = 0; i < vertexCount; i++) {
            try {
                vertices[i * 2] = Float.parseFloat(tokens[2 + i * 2]);
                vertices[i * 2 + 1] = Float.parseFloat(tokens[2 + i * 2 + 1]);
            } catch (NumberFormatException e) {
                throw new CLIError("POLY");
            }
        }
        Polygon poly = new Polygon(vertices);
        polygons.put(name, poly);
        System.out.println("POLY " + name + " " + vertexCount);
    }

    private void handleOverlap(String[] tokens, int lineNum) throws CLIError {
        // OVERLAP <a> <b>
        if (tokens.length != 3) {
            throw new CLIError("OVERLAP");
        }
        String nameA = tokens[1];
        String nameB = tokens[2];
        Polygon polyA = polygons.get(nameA);
        Polygon polyB = polygons.get(nameB);
        if (polyA == null) {
            throw new CLIError(nameA);
        }
        if (polyB == null) {
            throw new CLIError(nameB);
        }
        boolean result = Intersector.overlapConvexPolygons(polyA, polyB);
        System.out.println("OVERLAP " + nameA + " " + nameB + " " + result);
    }

    private void handleContains(String[] tokens, String originalLine, int lineNum) throws CLIError {
        // CONTAINS <name> <x> <y>
        if (tokens.length != 4) {
            throw new CLIError("CONTAINS");
        }
        String name = tokens[1];
        String xStr = tokens[2];
        String yStr = tokens[3];
        Polygon poly = polygons.get(name);
        if (poly == null) {
            throw new CLIError(name);
        }
        float x, y;
        try {
            x = Float.parseFloat(xStr);
            y = Float.parseFloat(yStr);
        } catch (NumberFormatException e) {
            throw new CLIError("CONTAINS");
        }
        float[] vertices = poly.getVertices();
        boolean result = Intersector.isPointInPolygon(vertices, 0, vertices.length, x, y);
        // Print the coordinates back exactly as they appeared in the input
        System.out.println("CONTAINS " + name + " " + xStr + " " + yStr + " " + result);
    }

    private void handleSegments(String[] tokens, int lineNum) throws CLIError {
        // SEGMENTS <ax> <ay> <bx> <by> <cx> <cy> <dx> <dy>
        if (tokens.length != 9) {
            throw new CLIError("SEGMENTS");
        }
        float[] coords = new float[8];
        for (int i = 0; i < 8; i++) {
            try {
                coords[i] = Float.parseFloat(tokens[i + 1]);
            } catch (NumberFormatException e) {
                throw new CLIError("SEGMENTS");
            }
        }
        Vector2 a = new Vector2(coords[0], coords[1]);
        Vector2 b = new Vector2(coords[2], coords[3]);
        Vector2 c = new Vector2(coords[4], coords[5]);
        Vector2 d = new Vector2(coords[6], coords[7]);
        Vector2 intersection = new Vector2();
        boolean hit = Intersector.intersectSegments(a, b, c, d, intersection);
        if (hit) {
            System.out.println("SEGMENTS hit "
                    + String.format(Locale.ROOT, "%.3f", intersection.x)
                    + " " + String.format(Locale.ROOT, "%.3f", intersection.y));
        } else {
            System.out.println("SEGMENTS miss");
        }
    }

    private void handleArea(String[] tokens, int lineNum) throws CLIError {
        // AREA <name>
        if (tokens.length != 2) {
            throw new CLIError("AREA");
        }
        String name = tokens[1];
        Polygon poly = polygons.get(name);
        if (poly == null) {
            throw new CLIError(name);
        }
        float area = poly.area();
        System.out.println("AREA " + name + " " + String.format(Locale.ROOT, "%.3f", area));
    }

    // Custom exception for CLI errors
    private static class CLIError extends Exception {
        CLIError(String message) {
            super(message);
        }
    }

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: PolygonCLI <script-path>");
            System.exit(1);
        }
        String scriptPath = args[0];
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;
        PolygonCLI listener = new PolygonCLI(scriptPath);
        new HeadlessApplication(listener, config);
        try {
            listener.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        System.exit(0);
    }
}
