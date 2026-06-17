package com.mygdx.game;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.math.Circle;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Rectangle;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class HeadlessLauncher {

    public static volatile int exitCode = 0;

    static class Shape {
        String id;
        Object geometry; // Either Rectangle or Circle

        Shape(String id, Object geometry) {
            this.id = id;
            this.geometry = geometry;
        }
    }

    static class OverlapPair implements Comparable<OverlapPair> {
        String idA;
        String idB;

        OverlapPair(String id1, String id2) {
            if (id1.compareTo(id2) < 0) {
                this.idA = id1;
                this.idB = id2;
            } else {
                this.idA = id2;
                this.idB = id1;
            }
        }

        @Override
        public int compareTo(OverlapPair o) {
            int cmp = this.idA.compareTo(o.idA);
            if (cmp != 0) {
                return cmp;
            }
            return this.idB.compareTo(o.idB);
        }

        @Override
        public boolean equals(Object obj) {
            if (this == obj) return true;
            if (obj == null || getClass() != obj.getClass()) return false;
            OverlapPair other = (OverlapPair) obj;
            return idA.equals(other.idA) && idB.equals(other.idB);
        }

        @Override
        public int hashCode() {
            return 31 * idA.hashCode() + idB.hashCode();
        }
    }

    public static void main(String[] args) {
        String shapesPath = null;
        String outputPath = null;

        for (String arg : args) {
            if (arg.startsWith("--shapes=")) {
                shapesPath = arg.substring("--shapes=".length());
            } else if (arg.startsWith("--output=")) {
                outputPath = arg.substring("--output=".length());
            }
        }

        if (shapesPath == null || outputPath == null) {
            System.err.println("Error: Missing required arguments --shapes=<path> and --output=<path>");
            System.exit(1);
        }

        final String finalShapesPath = shapesPath;
        final String finalOutputPath = outputPath;

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        new HeadlessApplication(new ApplicationListener() {
            @Override
            public void create() {
                try {
                    FileHandle file = Gdx.files.absolute(finalShapesPath);
                    if (!file.exists()) {
                        System.err.println("Error: Input file does not exist: " + finalShapesPath);
                        exitCode = 1;
                        Gdx.app.exit();
                        return;
                    }

                    List<Shape> shapes = new ArrayList<>();
                    Map<String, Shape> shapesMap = new HashMap<>();

                    try (BufferedReader reader = file.reader(8192, "UTF-8")) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            String trimmed = line.trim();
                            if (trimmed.isEmpty()) {
                                continue;
                            }
                            if (line.startsWith("#") || trimmed.startsWith("#")) {
                                continue;
                            }

                            String[] tokens = trimmed.split("\\s+");
                            if (tokens.length < 2) {
                                System.err.println("Error: invalid shape line: " + line);
                                exitCode = 1;
                                Gdx.app.exit();
                                return;
                            }

                            String id = tokens[0];
                            if (!id.matches("^[a-zA-Z0-9_-]+$")) {
                                System.err.println("Error: invalid shape line: " + line);
                                exitCode = 1;
                                Gdx.app.exit();
                                return;
                            }

                            String type = tokens[1];
                            if ("rect".equals(type)) {
                                if (tokens.length != 6) {
                                    System.err.println("Error: invalid shape line: " + line);
                                    exitCode = 1;
                                    Gdx.app.exit();
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
                                    exitCode = 1;
                                    Gdx.app.exit();
                                    return;
                                }
                                if (width <= 0 || height <= 0) {
                                    System.err.println("Error: invalid shape line: " + line);
                                    exitCode = 1;
                                    Gdx.app.exit();
                                    return;
                                }
                                if (shapesMap.containsKey(id)) {
                                    System.err.println("Error: duplicate id " + id);
                                    exitCode = 1;
                                    Gdx.app.exit();
                                    return;
                                }
                                Shape shape = new Shape(id, new Rectangle(x, y, width, height));
                                shapes.add(shape);
                                shapesMap.put(id, shape);

                            } else if ("circle".equals(type)) {
                                if (tokens.length != 5) {
                                    System.err.println("Error: invalid shape line: " + line);
                                    exitCode = 1;
                                    Gdx.app.exit();
                                    return;
                                }
                                float x, y, radius;
                                try {
                                    x = Float.parseFloat(tokens[2]);
                                    y = Float.parseFloat(tokens[3]);
                                    radius = Float.parseFloat(tokens[4]);
                                } catch (NumberFormatException e) {
                                    System.err.println("Error: invalid shape line: " + line);
                                    exitCode = 1;
                                    Gdx.app.exit();
                                    return;
                                }
                                if (radius <= 0) {
                                    System.err.println("Error: invalid shape line: " + line);
                                    exitCode = 1;
                                    Gdx.app.exit();
                                    return;
                                }
                                if (shapesMap.containsKey(id)) {
                                    System.err.println("Error: duplicate id " + id);
                                    exitCode = 1;
                                    Gdx.app.exit();
                                    return;
                                }
                                Shape shape = new Shape(id, new Circle(x, y, radius));
                                shapes.add(shape);
                                shapesMap.put(id, shape);

                            } else {
                                System.err.println("Error: invalid shape line: " + line);
                                exitCode = 1;
                                Gdx.app.exit();
                                return;
                            }
                        }
                    } catch (IOException e) {
                        System.err.println("Error reading file: " + e.getMessage());
                        exitCode = 1;
                        Gdx.app.exit();
                        return;
                    }

                    // Compute overlaps
                    List<OverlapPair> overlapsList = new ArrayList<>();
                    for (int i = 0; i < shapes.size(); i++) {
                        for (int j = i + 1; j < shapes.size(); j++) {
                            Shape s1 = shapes.get(i);
                            Shape s2 = shapes.get(j);
                            if (overlaps(s1, s2)) {
                                overlapsList.add(new OverlapPair(s1.id, s2.id));
                            }
                        }
                    }

                    // Sort overlaps
                    Collections.sort(overlapsList);

                    // Format output
                    StringBuilder sb = new StringBuilder();
                    for (OverlapPair pair : overlapsList) {
                        sb.append(pair.idA).append("\t").append(pair.idB).append("\n");
                    }
                    sb.append("total_overlaps=").append(overlapsList.size()).append("\n");

                    // Write output
                    try {
                        FileHandle outFile = Gdx.files.absolute(finalOutputPath);
                        FileHandle parent = outFile.parent();
                        if (parent != null && !parent.exists()) {
                            parent.mkdirs();
                        }
                        outFile.writeString(sb.toString(), false, "UTF-8");
                    } catch (Exception e) {
                        System.err.println("Error writing output file: " + e.getMessage());
                        exitCode = 1;
                        Gdx.app.exit();
                        return;
                    }

                    exitCode = 0;
                    Gdx.app.exit();

                } catch (Throwable t) {
                    t.printStackTrace();
                    exitCode = 1;
                    Gdx.app.exit();
                }
            }

            private boolean overlaps(Shape s1, Shape s2) {
                Object g1 = s1.geometry;
                Object g2 = s2.geometry;

                if (g1 instanceof Rectangle && g2 instanceof Rectangle) {
                    return ((Rectangle) g1).overlaps((Rectangle) g2);
                } else if (g1 instanceof Circle && g2 instanceof Circle) {
                    return ((Circle) g1).overlaps((Circle) g2);
                } else if (g1 instanceof Circle && g2 instanceof Rectangle) {
                    return Intersector.overlaps((Circle) g1, (Rectangle) g2);
                } else if (g1 instanceof Rectangle && g2 instanceof Circle) {
                    return Intersector.overlaps((Circle) g2, (Rectangle) g1);
                }
                return false;
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
            public void dispose() {}
        }, config);

        // Wait for headless thread to finish
        joinHeadlessThread();

        System.exit(exitCode);
    }

    private static void joinHeadlessThread() {
        // Sleep a bit to allow thread to start
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        Thread[] threads = new Thread[Thread.activeCount() * 2];
        int count = Thread.enumerate(threads);
        for (int i = 0; i < count; i++) {
            Thread t = threads[i];
            if (t != null && t.getName().contains("HeadlessApplication")) {
                try {
                    t.join();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }
    }
}
