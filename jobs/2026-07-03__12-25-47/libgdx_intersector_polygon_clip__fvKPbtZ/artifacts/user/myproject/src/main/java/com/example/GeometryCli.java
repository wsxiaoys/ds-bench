package com.example;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Polygon;
import com.badlogic.gdx.math.Vector2;

import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class GeometryCli extends ApplicationAdapter {

    private String scriptPath;
    private static final PrintStream OUT = new PrintStream(System.out, true, StandardCharsets.UTF_8);

    public GeometryCli(String scriptPath) {
        this.scriptPath = scriptPath;
    }

    @Override
    public void create() {
        try {
            List<String> lines = Files.readAllLines(Paths.get(scriptPath), StandardCharsets.UTF_8);
            Map<String, Polygon> polygons = new HashMap<>();
            Map<String, float[]> vertexArrays = new LinkedHashMap<>();
            Pattern polyNamePattern = Pattern.compile("^[A-Za-z][A-Za-z0-9_]*$");

            for (int i = 0; i < lines.size(); i++) {
                int lineNo = i + 1; // 1-based including blanks/comments
                String raw = lines.get(i);
                if (raw == null) continue;
                String line = raw.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;

                String[] tokens = line.split("\\s+");
                if (tokens.length == 0) continue;
                String cmd = tokens[0];
                try {
                    switch (cmd) {
                        case "POLY": {
                            // POLY <name> <x1> <y1> ... <xn> <yn>
                            if (tokens.length < 2) {
                                OUT.println("ERROR " + lineNo + " POLY");
                                break;
                            }
                            String name = tokens[1];
                            if (!polyNamePattern.matcher(name).matches()) {
                                OUT.println("ERROR " + lineNo + " POLY");
                                break;
                            }
                            int numPairs = tokens.length - 2;
                            if (numPairs < 6 || (numPairs % 2) != 0) {
                                OUT.println("ERROR " + lineNo + " POLY");
                                break;
                            }
                            int n = numPairs / 2;
                            float[] verts = new float[numPairs];
                            try {
                                for (int k = 0; k < numPairs; k++) {
                                    verts[k] = Float.parseFloat(tokens[2 + k]);
                                }
                            } catch (NumberFormatException nfe) {
                                OUT.println("ERROR " + lineNo + " POLY");
                                break;
                            }
                            Polygon p = new Polygon(verts);
                            p.setPosition(0f, 0f);
                            polygons.put(name, p);
                            vertexArrays.put(name, verts);
                            OUT.println("POLY " + name + " " + n);
                            break;
                        }
                        case "OVERLAP": {
                            if (tokens.length != 3) {
                                OUT.println("ERROR " + lineNo + " OVERLAP");
                                break;
                            }
                            String a = tokens[1];
                            String b = tokens[2];
                            if (!polygons.containsKey(a) || !polygons.containsKey(b)) {
                                OUT.println("ERROR " + lineNo + " OVERLAP");
                                break;
                            }
                            Polygon pa = polygons.get(a);
                            Polygon pb = polygons.get(b);
                            boolean overlap = Intersector.overlapConvexPolygons(pa, pb);
                            OUT.println("OVERLAP " + a + " " + b + " " + (overlap ? "true" : "false"));
                            break;
                        }
                        case "CONTAINS": {
                            // CONTAINS <name> <x> <y>
                            if (tokens.length != 4) {
                                OUT.println("ERROR " + lineNo + " CONTAINS");
                                break;
                            }
                            String name = tokens[1];
                            if (!vertexArrays.containsKey(name)) {
                                OUT.println("ERROR " + lineNo + " CONTAINS");
                                break;
                            }
                            float x, y;
                            try {
                                x = Float.parseFloat(tokens[2]);
                                y = Float.parseFloat(tokens[3]);
                            } catch (NumberFormatException nfe) {
                                OUT.println("ERROR " + lineNo + " CONTAINS");
                                break;
                            }
                            float[] verts = vertexArrays.get(name);
                            boolean inside = Intersector.isPointInPolygon(verts, 0, verts.length, x, y);
                            // Preserve input formatting: tokens[2] and tokens[3] verbatim (no token reformat)
                            OUT.println("CONTAINS " + name + " " + tokens[2] + " " + tokens[3] + " " + (inside ? "true" : "false"));
                            break;
                        }
                        case "SEGMENTS": {
                            if (tokens.length != 9) {
                                OUT.println("ERROR " + lineNo + " SEGMENTS");
                                break;
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
                            } catch (NumberFormatException nfe) {
                                OUT.println("ERROR " + lineNo + " SEGMENTS");
                                break;
                            }
                            Vector2 a = new Vector2(ax, ay);
                            Vector2 b = new Vector2(bx, by);
                            Vector2 c = new Vector2(cx, cy);
                            Vector2 d = new Vector2(dx, dy);
                            Vector2 hit = new Vector2();
                            boolean intersects = Intersector.intersectSegments(a, b, c, d, hit);
                            if (intersects) {
                                OUT.println("SEGMENTS hit "
                                    + String.format(Locale.ROOT, "%.3f", hit.x) + " "
                                    + String.format(Locale.ROOT, "%.3f", hit.y));
                            } else {
                                OUT.println("SEGMENTS miss");
                            }
                            break;
                        }
                        case "AREA": {
                            if (tokens.length != 2) {
                                OUT.println("ERROR " + lineNo + " AREA");
                                break;
                            }
                            String name = tokens[1];
                            if (!polygons.containsKey(name)) {
                                OUT.println("ERROR " + lineNo + " AREA");
                                break;
                            }
                            Polygon p = polygons.get(name);
                            float area = p.area();
                            OUT.println("AREA " + name + " " + String.format(Locale.ROOT, "%.3f", area));
                            break;
                        }
                        default:
                            OUT.println("ERROR " + lineNo + " " + cmd);
                    }
                } catch (Exception ex) {
                    OUT.println("ERROR " + lineNo + " " + cmd);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        Gdx.app.exit();
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("Usage: geometry-cli <script-file>");
            System.exit(1);
        }
        String scriptPath = args[0];
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;
        HeadlessApplication app = new HeadlessApplication(new GeometryCli(scriptPath), config);
        // Wait until the application thread terminates
        // Gdx.app.exit() will let the main loop in HeadlessApplication finish.
        Thread mainLoopThread = getMainLoopThread(app);
        if (mainLoopThread != null) {
            mainLoopThread.join();
        }
    }

    private static Thread getMainLoopThread(HeadlessApplication app) {
        // HeadlessApplication maintains an internal thread running MainLoop;
        // access via reflection to join it cleanly.
        try {
            java.lang.reflect.Field f = HeadlessApplication.class.getDeclaredField("mainLoopThread");
            f.setAccessible(true);
            return (Thread) f.get(app);
        } catch (Throwable t) {
            return null;
        }
    }
}
