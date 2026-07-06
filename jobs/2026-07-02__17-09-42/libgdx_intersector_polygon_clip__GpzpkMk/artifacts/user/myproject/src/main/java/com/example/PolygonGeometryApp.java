package com.example;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Polygon;
import com.badlogic.gdx.math.Vector2;
import com.badlogic.gdx.utils.GdxNativesLoader;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Headless libGDX-based CLI utility for evaluating 2D convex polygon geometry
 * queries. Driven by a small scripting language; see {@link #processScript}.
 */
public class PolygonGeometryApp extends ApplicationAdapter {

    /** Polygon identifiers must match this pattern. */
    private static final Pattern IDENT = Pattern.compile("[A-Za-z][A-Za-z0-9_]*");

    /** Script file path passed via the first program argument. */
    private final String scriptPath;

    public PolygonGeometryApp(String scriptPath) {
        this.scriptPath = scriptPath;
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("Usage: PolygonGeometryApp <script-file>");
            System.exit(1);
        }
        String scriptPath = args[0];

        // We do not need the native gdx shared library: the headless backend
        // does no rendering, no audio, and no input. Skip the SharedLibraryLoader
        // so we don't try to extract libgdx64.so at startup.
        GdxNativesLoader.disableNativesLoading = true;

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Zero scheduled updates per second: tick once and exit.
        config.updatesPerSecond = 0;

        ApplicationListener listener = new PolygonGeometryApp(scriptPath);
        // Subclass to expose the main loop thread so main() can join on it.
        JoinableHeadlessApplication app = new JoinableHeadlessApplication(listener, config);

        // Wait for the headless main loop thread to terminate so all stdout is flushed.
        app.joinMainLoop();
    }

    /**
     * HeadlessApplication keeps its main loop thread in a {@code protected}
     * field. This thin subclass exposes it for joining from {@link #main}.
     */
    private static final class JoinableHeadlessApplication extends HeadlessApplication {
        JoinableHeadlessApplication(ApplicationListener listener,
                                   HeadlessApplicationConfiguration config) {
            super(listener, config);
        }

        void joinMainLoop() throws InterruptedException {
            mainLoopThread.join();
        }
    }

    @Override
    public void create() {
        try {
            processScript(scriptPath);
        } catch (Exception e) {
            // Don't let an exception kill the loop before we call exit().
            System.err.println("Internal error: " + e.getMessage());
        } finally {
            Gdx.app.exit();
        }
    }

    /**
     * Read the script file and dispatch one command per non-blank, non-comment
     * line. Outputs exactly one line per processed line.
     */
    private void processScript(String path) throws IOException {
        Map<String, Polygon> polygons = new HashMap<>();
        Map<String, float[]> vertices = new HashMap<>();

        try (BufferedReader reader = Files.newBufferedReader(Paths.get(path), StandardCharsets.UTF_8)) {
            String rawLine;
            int lineNumber = 0;
            while ((rawLine = reader.readLine()) != null) {
                lineNumber++;
                String trimmed = rawLine.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                processLine(trimmed, lineNumber, polygons, vertices);
            }
        }
    }

    private void processLine(String line,
                             int lineNumber,
                             Map<String, Polygon> polygons,
                             Map<String, float[]> vertices) {
        String[] tokens = line.split("\\s+");
        if (tokens.length == 0) {
            return;
        }
        String cmd = tokens[0];

        switch (cmd) {
            case "POLY":
                handlePoly(tokens, lineNumber, polygons, vertices);
                break;
            case "OVERLAP":
                handleOverlap(tokens, lineNumber, polygons);
                break;
            case "CONTAINS":
                handleContains(tokens, lineNumber, vertices);
                break;
            case "SEGMENTS":
                handleSegments(tokens, lineNumber);
                break;
            case "AREA":
                handleArea(tokens, lineNumber, polygons);
                break;
            default:
                System.out.println("ERROR " + lineNumber + " " + cmd);
        }
    }

    private static boolean isValidIdent(String s) {
        return IDENT.matcher(s).matches();
    }

    private void handlePoly(String[] tokens,
                            int lineNumber,
                            Map<String, Polygon> polygons,
                            Map<String, float[]> vertices) {
        if (tokens.length < 3) { // POLY <name> <coord>
            System.out.println("ERROR " + lineNumber + " POLY");
            return;
        }
        String name = tokens[1];
        if (!isValidIdent(name)) {
            System.out.println("ERROR " + lineNumber + " POLY");
            return;
        }

        int coordCount = tokens.length - 2;
        if (coordCount < 6 || coordCount % 2 != 0) {
            System.out.println("ERROR " + lineNumber + " POLY");
            return;
        }

        float[] verts = new float[coordCount];
        for (int i = 0; i < coordCount; i++) {
            String tok = tokens[2 + i];
            float f;
            try {
                f = Float.parseFloat(tok);
            } catch (NumberFormatException ex) {
                System.out.println("ERROR " + lineNumber + " POLY");
                return;
            }
            verts[i] = f;
        }

        Polygon poly;
        try {
            poly = new Polygon(verts);
        } catch (RuntimeException ex) {
            System.out.println("ERROR " + lineNumber + " POLY");
            return;
        }

        polygons.put(name, poly);
        vertices.put(name, verts);
        System.out.println("POLY " + name + " " + (coordCount / 2));
    }

    private void handleOverlap(String[] tokens, int lineNumber, Map<String, Polygon> polygons) {
        if (tokens.length != 3) {
            System.out.println("ERROR " + lineNumber + " OVERLAP");
            return;
        }
        String a = tokens[1];
        String b = tokens[2];
        if (!isValidIdent(a) || !isValidIdent(b)) {
            System.out.println("ERROR " + lineNumber + " OVERLAP");
            return;
        }
        Polygon pa = polygons.get(a);
        Polygon pb = polygons.get(b);
        if (pa == null || pb == null) {
            System.out.println("ERROR " + lineNumber + " OVERLAP");
            return;
        }
        boolean result = Intersector.overlapConvexPolygons(pa, pb);
        System.out.println("OVERLAP " + a + " " + b + " " + result);
    }

    private void handleContains(String[] tokens, int lineNumber, Map<String, float[]> vertices) {
        if (tokens.length != 4) {
            System.out.println("ERROR " + lineNumber + " CONTAINS");
            return;
        }
        String name = tokens[1];
        String xStr = tokens[2];
        String yStr = tokens[3];
        if (!isValidIdent(name)) {
            System.out.println("ERROR " + lineNumber + " CONTAINS");
            return;
        }
        float[] verts = vertices.get(name);
        if (verts == null) {
            System.out.println("ERROR " + lineNumber + " CONTAINS");
            return;
        }
        float x, y;
        try {
            x = Float.parseFloat(xStr);
            y = Float.parseFloat(yStr);
        } catch (NumberFormatException ex) {
            System.out.println("ERROR " + lineNumber + " CONTAINS");
            return;
        }
        boolean result;
        try {
            result = Intersector.isPointInPolygon(verts, 0, verts.length, x, y);
        } catch (RuntimeException ex) {
            System.out.println("ERROR " + lineNumber + " CONTAINS");
            return;
        }
        // Preserve the original tokens so user formatting is echoed back.
        System.out.println("CONTAINS " + name + " " + xStr + " " + yStr + " " + result);
    }

    private void handleSegments(String[] tokens, int lineNumber) {
        if (tokens.length != 9) {
            System.out.println("ERROR " + lineNumber + " SEGMENTS");
            return;
        }
        float[] v = new float[8];
        for (int i = 0; i < 8; i++) {
            try {
                v[i] = Float.parseFloat(tokens[1 + i]);
            } catch (NumberFormatException ex) {
                System.out.println("ERROR " + lineNumber + " SEGMENTS");
                return;
            }
        }
        Vector2 p1 = new Vector2(v[0], v[1]);
        Vector2 p2 = new Vector2(v[2], v[3]);
        Vector2 p3 = new Vector2(v[4], v[5]);
        Vector2 p4 = new Vector2(v[6], v[7]);
        Vector2 hit = new Vector2();
        boolean intersects;
        try {
            intersects = Intersector.intersectSegments(p1, p2, p3, p4, hit);
        } catch (RuntimeException ex) {
            System.out.println("ERROR " + lineNumber + " SEGMENTS");
            return;
        }
        if (intersects) {
            System.out.println("SEGMENTS hit "
                    + String.format(Locale.ROOT, "%.3f", hit.x) + " "
                    + String.format(Locale.ROOT, "%.3f", hit.y));
        } else {
            System.out.println("SEGMENTS miss");
        }
    }

    private void handleArea(String[] tokens, int lineNumber, Map<String, Polygon> polygons) {
        if (tokens.length != 2) {
            System.out.println("ERROR " + lineNumber + " AREA");
            return;
        }
        String name = tokens[1];
        if (!isValidIdent(name)) {
            System.out.println("ERROR " + lineNumber + " AREA");
            return;
        }
        Polygon p = polygons.get(name);
        if (p == null) {
            System.out.println("ERROR " + lineNumber + " AREA");
            return;
        }
        float area;
        try {
            area = p.area();
        } catch (RuntimeException ex) {
            System.out.println("ERROR " + lineNumber + " AREA");
            return;
        }
        System.out.println("AREA " + name + " " + String.format(Locale.ROOT, "%.3f", area));
    }
}