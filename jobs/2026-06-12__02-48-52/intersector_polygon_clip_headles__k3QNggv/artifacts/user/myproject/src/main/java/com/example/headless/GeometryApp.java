package com.example.headless;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Polygon;
import com.badlogic.gdx.math.Vector2;

import java.io.BufferedReader;
import java.io.FileReader;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class GeometryApp extends ApplicationAdapter {
    private final String scriptPath;
    private final Map<String, Polygon> polygons = new HashMap<>();

    public GeometryApp(String scriptPath) {
        this.scriptPath = scriptPath;
    }

    @Override
    public void create() {
        processScript();
        System.out.flush();
        Gdx.app.exit();
    }

    private void processScript() {
        try (BufferedReader reader = new BufferedReader(new FileReader(scriptPath))) {
            String line;
            int lineNumber = 0;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                
                String[] tokens = line.split("\\s+");
                String command = tokens[0].toUpperCase(Locale.ROOT);
                
                try {
                    switch (command) {
                        case "POLY":
                            if (tokens.length < 8 || (tokens.length - 2) % 2 != 0) {
                                System.out.println("ERROR " + lineNumber + " " + command);
                                break;
                            }
                            String name = tokens[1];
                            int vertexCount = (tokens.length - 2) / 2;
                            float[] vertices = new float[vertexCount * 2];
                            for (int i = 0; i < vertexCount * 2; i++) {
                                vertices[i] = Float.parseFloat(tokens[i + 2]);
                            }
                            polygons.put(name, new Polygon(vertices));
                            System.out.println("POLY " + name + " " + vertexCount);
                            break;
                            
                        case "OVERLAP":
                            if (tokens.length != 3) {
                                System.out.println("ERROR " + lineNumber + " " + command);
                                break;
                            }
                            Polygon p1 = polygons.get(tokens[1]);
                            Polygon p2 = polygons.get(tokens[2]);
                            if (p1 == null || p2 == null) {
                                System.out.println("ERROR " + lineNumber + " " + command);
                                break;
                            }
                            boolean overlap = Intersector.overlapConvexPolygons(p1, p2);
                            System.out.println("OVERLAP " + tokens[1] + " " + tokens[2] + " " + overlap);
                            break;
                            
                        case "CONTAINS":
                            if (tokens.length != 4) {
                                System.out.println("ERROR " + lineNumber + " " + command);
                                break;
                            }
                            Polygon p = polygons.get(tokens[1]);
                            if (p == null) {
                                System.out.println("ERROR " + lineNumber + " " + command);
                                break;
                            }
                            float x = Float.parseFloat(tokens[2]);
                            float y = Float.parseFloat(tokens[3]);
                            boolean contains = Intersector.isPointInPolygon(p.getVertices(), 0, p.getVertices().length, x, y);
                            System.out.println("CONTAINS " + tokens[1] + " " + tokens[2] + " " + tokens[3] + " " + contains);
                            break;
                            
                        case "SEGMENTS":
                            if (tokens.length != 9) {
                                System.out.println("ERROR " + lineNumber + " " + command);
                                break;
                            }
                            Vector2 a = new Vector2(Float.parseFloat(tokens[1]), Float.parseFloat(tokens[2]));
                            Vector2 b = new Vector2(Float.parseFloat(tokens[3]), Float.parseFloat(tokens[4]));
                            Vector2 c = new Vector2(Float.parseFloat(tokens[5]), Float.parseFloat(tokens[6]));
                            Vector2 d = new Vector2(Float.parseFloat(tokens[7]), Float.parseFloat(tokens[8]));
                            Vector2 intersection = new Vector2();
                            boolean hit = Intersector.intersectSegments(a, b, c, d, intersection);
                            if (hit) {
                                System.out.printf(Locale.ROOT, "SEGMENTS hit %.3f %.3f%n", intersection.x, intersection.y);
                            } else {
                                System.out.println("SEGMENTS miss");
                            }
                            break;
                            
                        case "AREA":
                            if (tokens.length != 2) {
                                System.out.println("ERROR " + lineNumber + " " + command);
                                break;
                            }
                            Polygon pArea = polygons.get(tokens[1]);
                            if (pArea == null) {
                                System.out.println("ERROR " + lineNumber + " " + command);
                                break;
                            }
                            float area = pArea.area();
                            System.out.printf(Locale.ROOT, "AREA %s %.3f%n", tokens[1], area);
                            break;
                            
                        default:
                            System.out.println("ERROR " + lineNumber + " " + command);
                            break;
                    }
                } catch (Exception e) {
                    System.out.println("ERROR " + lineNumber + " " + command);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
