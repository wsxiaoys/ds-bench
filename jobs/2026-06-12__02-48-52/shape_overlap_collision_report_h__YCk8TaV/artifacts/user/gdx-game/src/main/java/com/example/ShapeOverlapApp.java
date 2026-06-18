package com.example;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.Circle;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Rectangle;
import java.io.BufferedReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;

public class ShapeOverlapApp extends ApplicationAdapter {
    private final String shapesPath;
    private final String outputPath;
    public final CountDownLatch latch = new CountDownLatch(1);
    public int exitCode = 0;

    public ShapeOverlapApp(String shapesPath, String outputPath) {
        this.shapesPath = shapesPath;
        this.outputPath = outputPath;
    }

    static abstract class ShapeDef {
        String id;
        ShapeDef(String id) { this.id = id; }
        abstract boolean overlaps(ShapeDef other);
    }

    static class RectDef extends ShapeDef {
        Rectangle rect;
        RectDef(String id, float x, float y, float w, float h) {
            super(id);
            this.rect = new Rectangle(x, y, w, h);
        }
        @Override
        boolean overlaps(ShapeDef other) {
            if (other instanceof RectDef) {
                return this.rect.overlaps(((RectDef)other).rect);
            } else if (other instanceof CircDef) {
                return Intersector.overlaps(((CircDef)other).circ, this.rect);
            }
            return false;
        }
    }

    static class CircDef extends ShapeDef {
        Circle circ;
        CircDef(String id, float x, float y, float r) {
            super(id);
            this.circ = new Circle(x, y, r);
        }
        @Override
        boolean overlaps(ShapeDef other) {
            if (other instanceof CircDef) {
                return this.circ.overlaps(((CircDef)other).circ);
            } else if (other instanceof RectDef) {
                return Intersector.overlaps(this.circ, ((RectDef)other).rect);
            }
            return false;
        }
    }

    @Override
    public void create() {
        try {
            process();
        } catch (Exception e) {
            e.printStackTrace();
            exitCode = 1;
        } finally {
            Gdx.app.exit();
            latch.countDown();
        }
    }

    private void process() {
        List<ShapeDef> shapes = new ArrayList<>();
        Set<String> ids = new HashSet<>();

        try (BufferedReader reader = new BufferedReader(Gdx.files.absolute(shapesPath).reader("UTF-8"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty() || line.startsWith("#")) {
                    continue;
                }
                
                String[] tokens = line.trim().split("\\s+");
                if (tokens.length < 2) {
                    System.err.println("Error: invalid shape line: " + line);
                    exitCode = 1;
                    return;
                }
                
                String id = tokens[0];
                if (!id.matches("^[a-zA-Z0-9_\\-]+$")) {
                    System.err.println("Error: invalid shape line: " + line);
                    exitCode = 1;
                    return;
                }
                
                if (!ids.add(id)) {
                    System.err.println("Error: duplicate id " + id);
                    exitCode = 1;
                    return;
                }

                String type = tokens[1];
                try {
                    if (type.equals("rect")) {
                        if (tokens.length != 6) throw new IllegalArgumentException();
                        float x = Float.parseFloat(tokens[2]);
                        float y = Float.parseFloat(tokens[3]);
                        float w = Float.parseFloat(tokens[4]);
                        float h = Float.parseFloat(tokens[5]);
                        if (w <= 0 || h <= 0) throw new IllegalArgumentException();
                        shapes.add(new RectDef(id, x, y, w, h));
                    } else if (type.equals("circle")) {
                        if (tokens.length != 5) throw new IllegalArgumentException();
                        float x = Float.parseFloat(tokens[2]);
                        float y = Float.parseFloat(tokens[3]);
                        float r = Float.parseFloat(tokens[4]);
                        if (r <= 0) throw new IllegalArgumentException();
                        shapes.add(new CircDef(id, x, y, r));
                    } else {
                        throw new IllegalArgumentException();
                    }
                } catch (Exception e) {
                    System.err.println("Error: invalid shape line: " + line);
                    exitCode = 1;
                    return;
                }
            }
        } catch (Exception e) {
            System.err.println("Error: unable to read input file");
            exitCode = 1;
            return;
        }

        List<String> overlaps = new ArrayList<>();
        for (int i = 0; i < shapes.size(); i++) {
            for (int j = i + 1; j < shapes.size(); j++) {
                ShapeDef s1 = shapes.get(i);
                ShapeDef s2 = shapes.get(j);
                if (s1.overlaps(s2)) {
                    String id1 = s1.id;
                    String id2 = s2.id;
                    if (id1.compareTo(id2) > 0) {
                        String temp = id1;
                        id1 = id2;
                        id2 = temp;
                    }
                    overlaps.add(id1 + "\t" + id2);
                }
            }
        }

        Collections.sort(overlaps);

        StringBuilder sb = new StringBuilder();
        for (String pair : overlaps) {
            sb.append(pair).append("\n");
        }
        sb.append("total_overlaps=").append(overlaps.size()).append("\n");

        try {
            Gdx.files.absolute(outputPath).writeString(sb.toString(), false, "UTF-8");
        } catch (Exception e) {
            System.err.println("Error: unable to write output file");
            exitCode = 1;
            return;
        }
        
        exitCode = 0;
    }
}