package com.myproject.geometry;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Polygon;
import com.badlogic.gdx.math.Vector2;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

public class GeometryApp extends ApplicationAdapter {
    private final String scriptPath;
    private final CountDownLatch latch;
    private final Map<String, Polygon> polygons = new HashMap<>();

    public GeometryApp(String scriptPath, CountDownLatch latch) {
        this.scriptPath = scriptPath;
        this.latch = latch;
    }

    @Override
    public void create() {
        try (BufferedReader reader = new BufferedReader(new FileReader(scriptPath))) {
            String line;
            int lineNumber = 0;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }

                String[] tokens = trimmed.split("\\s+");
                if (tokens.length == 0) {
                    continue;
                }

                String command = tokens[0];
                try {
                    if (command.equals("POLY")) {
                        handlePoly(tokens, lineNumber);
                    } else if (command.equals("OVERLAP")) {
                        handleOverlap(tokens, lineNumber);
                    } else if (command.equals("CONTAINS")) {
                        handleContains(tokens, lineNumber);
                    } else if (command.equals("SEGMENTS")) {
                        handleSegments(tokens, lineNumber);
                    } else if (command.equals("AREA")) {
                        handleArea(tokens, lineNumber);
                    } else {
                        System.out.println("ERROR " + lineNumber + " " + command);
                    }
                } catch (Exception e) {
                    System.out.println("ERROR " + lineNumber + " " + command);
                }
            }
        } catch (IOException e) {
            System.err.println("Error reading script file: " + e.getMessage());
        } finally {
            Gdx.app.exit();
        }
    }

    private void handlePoly(String[] tokens, int lineNumber) {
        if (tokens.length < 8) {
            System.out.println("ERROR " + lineNumber + " POLY");
            return;
        }
        String name = tokens[1];
        if (!name.matches("[A-Za-z][A-Za-z0-9_]*")) {
            System.out.println("ERROR " + lineNumber + " POLY");
            return;
        }
        if ((tokens.length - 2) % 2 != 0) {
            System.out.println("ERROR " + lineNumber + " POLY");
            return;
        }

        int vertexCount = (tokens.length - 2) / 2;
        float[] vertices = new float[tokens.length - 2];
        for (int i = 2; i < tokens.length; i++) {
            vertices[i - 2] = Float.parseFloat(tokens[i]);
        }

        Polygon polygon = new Polygon(vertices);
        polygons.put(name, polygon);
        System.out.println("POLY " + name + " " + vertexCount);
    }

    private void handleOverlap(String[] tokens, int lineNumber) {
        if (tokens.length != 3) {
            System.out.println("ERROR " + lineNumber + " OVERLAP");
            return;
        }
        String nameA = tokens[1];
        String nameB = tokens[2];
        Polygon polyA = polygons.get(nameA);
        Polygon polyB = polygons.get(nameB);
        if (polyA == null || polyB == null) {
            System.out.println("ERROR " + lineNumber + " OVERLAP");
            return;
        }

        boolean overlap = Intersector.overlapConvexPolygons(polyA, polyB);
        System.out.println("OVERLAP " + nameA + " " + nameB + " " + overlap);
    }

    private void handleContains(String[] tokens, int lineNumber) {
        if (tokens.length != 4) {
            System.out.println("ERROR " + lineNumber + " CONTAINS");
            return;
        }
        String name = tokens[1];
        Polygon polygon = polygons.get(name);
        if (polygon == null) {
            System.out.println("ERROR " + lineNumber + " CONTAINS");
            return;
        }

        String xStr = tokens[2];
        String yStr = tokens[3];
        float x = Float.parseFloat(xStr);
        float y = Float.parseFloat(yStr);

        float[] vertices = polygon.getTransformedVertices();
        boolean contains = Intersector.isPointInPolygon(vertices, 0, vertices.length, x, y);
        System.out.println("CONTAINS " + name + " " + xStr + " " + yStr + " " + contains);
    }

    private void handleSegments(String[] tokens, int lineNumber) {
        if (tokens.length != 9) {
            System.out.println("ERROR " + lineNumber + " SEGMENTS");
            return;
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

    private void handleArea(String[] tokens, int lineNumber) {
        if (tokens.length != 2) {
            System.out.println("ERROR " + lineNumber + " AREA");
            return;
        }
        String name = tokens[1];
        Polygon polygon = polygons.get(name);
        if (polygon == null) {
            System.out.println("ERROR " + lineNumber + " AREA");
            return;
        }

        float area = polygon.area();
        String areaStr = String.format(Locale.ROOT, "%.3f", area);
        System.out.println("AREA " + name + " " + areaStr);
    }

    @Override
    public void dispose() {
        latch.countDown();
    }
}
