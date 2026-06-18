package com.example.geom;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Polygon;
import com.badlogic.gdx.math.Vector2;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.io.PrintStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

/**
 * ApplicationAdapter that processes the geometry script in {@code create()},
 * then calls {@code Gdx.app.exit()} so the headless loop shuts down cleanly.
 *
 * <p>All output is written to {@code System.out} (one line per non-comment,
 * non-blank script line).  Errors print {@code ERROR <lineNo> <reason>} and
 * continue processing the rest of the script.</p>
 */
public class GeomListener extends ApplicationAdapter {

    private final String scriptPath;

    /** Latch released once create() finishes; lets main() block until done. */
    private final CountDownLatch doneLatch = new CountDownLatch(1);

    /** Polygon store keyed by name. */
    private final Map<String, Polygon> polygons = new HashMap<>();

    /** Stdout writer (kept as a field so we can flush at the end). */
    private final PrintStream out = System.out;

    public GeomListener(String scriptPath) {
        this.scriptPath = scriptPath;
    }

    // -----------------------------------------------------------------------
    // ApplicationAdapter lifecycle
    // -----------------------------------------------------------------------

    @Override
    public void create() {
        try {
            processScript();
        } finally {
            out.flush();
            doneLatch.countDown();
            Gdx.app.exit();
        }
    }

    /** Block until the create() method has finished and Gdx.app.exit() called. */
    public void awaitDone() throws InterruptedException {
        doneLatch.await();
    }

    // -----------------------------------------------------------------------
    // Script processing
    // -----------------------------------------------------------------------

    private void processScript() {
        try (BufferedReader reader = new BufferedReader(new FileReader(scriptPath))) {
            String rawLine;
            int lineNumber = 0;
            while ((rawLine = reader.readLine()) != null) {
                lineNumber++;
                String line = rawLine.trim();

                // Skip blank lines and comments
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                processLine(line, lineNumber);
            }
        } catch (IOException e) {
            System.err.println("Failed to read script: " + e.getMessage());
        }
    }

    private void processLine(String line, int lineNumber) {
        // Split on whitespace; tokens[0] is the command keyword
        String[] tokens = line.split("\\s+");
        if (tokens.length == 0) {
            return; // should not happen after trim+empty check, but be safe
        }

        String cmd = tokens[0].toUpperCase(Locale.ROOT);

        try {
            switch (cmd) {
                case "POLY":
                    handlePoly(tokens, line, lineNumber);
                    break;
                case "OVERLAP":
                    handleOverlap(tokens, line, lineNumber);
                    break;
                case "CONTAINS":
                    handleContains(tokens, line, lineNumber);
                    break;
                case "SEGMENTS":
                    handleSegments(tokens, line, lineNumber);
                    break;
                case "AREA":
                    handleArea(tokens, line, lineNumber);
                    break;
                default:
                    out.println("ERROR " + lineNumber + " " + tokens[0]);
            }
        } catch (ErrorException e) {
            out.println("ERROR " + lineNumber + " " + e.reason);
        }
    }

    // -----------------------------------------------------------------------
    // Command handlers
    // -----------------------------------------------------------------------

    /**
     * POLY <name> <x1> <y1> ... <xn> <yn>
     * Requires at least 3 vertices (6 coordinate tokens after the name).
     */
    private void handlePoly(String[] tokens, String line, int lineNumber) throws ErrorException {
        // tokens[0] = "POLY", tokens[1] = name, tokens[2..] = coordinates
        if (tokens.length < 8) {
            // name + at least 6 coords = 8 tokens minimum
            throw new ErrorException("POLY requires name and at least 3 vertices (6 coordinates)");
        }

        String name = tokens[1];
        if (!name.matches("[A-Za-z][A-Za-z0-9_]*")) {
            throw new ErrorException("invalid polygon name: " + name);
        }

        int coordCount = tokens.length - 2;
        if (coordCount < 6 || coordCount % 2 != 0) {
            throw new ErrorException("POLY requires an even number of coordinates (>=6)");
        }

        float[] verts = new float[coordCount];
        for (int i = 0; i < coordCount; i++) {
            verts[i] = parseFloat(tokens[i + 2], lineNumber);
        }

        Polygon poly = new Polygon(verts);
        polygons.put(name, poly);

        int vertexCount = coordCount / 2;
        out.println("POLY " + name + " " + vertexCount);
    }

    /**
     * OVERLAP <a> <b>
     */
    private void handleOverlap(String[] tokens, String line, int lineNumber) throws ErrorException {
        if (tokens.length != 3) {
            throw new ErrorException("OVERLAP requires exactly 2 polygon names");
        }

        String nameA = tokens[1];
        String nameB = tokens[2];

        Polygon polyA = requirePolygon(nameA, lineNumber);
        Polygon polyB = requirePolygon(nameB, lineNumber);

        boolean overlap = Intersector.overlapConvexPolygons(polyA, polyB);
        out.println("OVERLAP " + nameA + " " + nameB + " " + overlap);
    }

    /**
     * CONTAINS <name> <x> <y>
     * Prints coordinates back exactly as they appeared in the script.
     */
    private void handleContains(String[] tokens, String line, int lineNumber) throws ErrorException {
        if (tokens.length != 4) {
            throw new ErrorException("CONTAINS requires polygon name, x, and y");
        }

        String name = tokens[1];
        String xTok = tokens[2];
        String yTok = tokens[3];

        Polygon poly = requirePolygon(name, lineNumber);

        float x = parseFloat(xTok, lineNumber);
        float y = parseFloat(yTok, lineNumber);

        // isPointInPolygon(float[] polygon, int offset, int count, float x, float y)
        float[] verts = poly.getTransformedVertices();
        boolean inside = Intersector.isPointInPolygon(verts, 0, verts.length, x, y);

        // Print coordinates back exactly as typed (preserve formatting tokens)
        out.println("CONTAINS " + name + " " + xTok + " " + yTok + " " + inside);
    }

    /**
     * SEGMENTS <ax> <ay> <bx> <by> <cx> <cy> <dx> <dy>
     */
    private void handleSegments(String[] tokens, String line, int lineNumber) throws ErrorException {
        if (tokens.length != 9) {
            throw new ErrorException("SEGMENTS requires 8 coordinate values");
        }

        float ax = parseFloat(tokens[1], lineNumber);
        float ay = parseFloat(tokens[2], lineNumber);
        float bx = parseFloat(tokens[3], lineNumber);
        float by = parseFloat(tokens[4], lineNumber);
        float cx = parseFloat(tokens[5], lineNumber);
        float cy = parseFloat(tokens[6], lineNumber);
        float dx = parseFloat(tokens[7], lineNumber);
        float dy = parseFloat(tokens[8], lineNumber);

        Vector2 a = new Vector2(ax, ay);
        Vector2 b = new Vector2(bx, by);
        Vector2 c = new Vector2(cx, cy);
        Vector2 d = new Vector2(dx, dy);
        Vector2 intersection = new Vector2();

        boolean hit = Intersector.intersectSegments(a, b, c, d, intersection);

        if (hit) {
            String px = String.format(Locale.ROOT, "%.3f", intersection.x);
            String py = String.format(Locale.ROOT, "%.3f", intersection.y);
            out.println("SEGMENTS hit " + px + " " + py);
        } else {
            out.println("SEGMENTS miss");
        }
    }

    /**
     * AREA <name>
     */
    private void handleArea(String[] tokens, String line, int lineNumber) throws ErrorException {
        if (tokens.length != 2) {
            throw new ErrorException("AREA requires exactly 1 polygon name");
        }

        String name = tokens[1];
        Polygon poly = requirePolygon(name, lineNumber);

        float area = poly.area();
        out.println("AREA " + name + " " + String.format(Locale.ROOT, "%.3f", area));
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private Polygon requirePolygon(String name, int lineNumber) throws ErrorException {
        Polygon p = polygons.get(name);
        if (p == null) {
            throw new ErrorException("undefined polygon: " + name);
        }
        return p;
    }

    private float parseFloat(String token, int lineNumber) throws ErrorException {
        try {
            return Float.parseFloat(token);
        } catch (NumberFormatException e) {
            throw new ErrorException("malformed number: " + token);
        }
    }

    // -----------------------------------------------------------------------
    // Internal exception used to unify error reporting
    // -----------------------------------------------------------------------

    private static final class ErrorException extends Exception {
        final String reason;

        ErrorException(String reason) {
            super(reason);
            this.reason = reason;
        }
    }
}
