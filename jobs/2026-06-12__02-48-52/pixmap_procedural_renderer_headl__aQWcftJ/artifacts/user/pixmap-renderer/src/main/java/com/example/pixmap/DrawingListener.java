package com.example.pixmap;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Pixmap.Format;
import com.badlogic.gdx.graphics.PixmapIO;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.concurrent.CountDownLatch;

/**
 * libGDX {@link ApplicationAdapter} that:
 * <ol>
 *   <li>Reads a plain-text command script from {@code inputPath}.</li>
 *   <li>Executes each drawing command against a single {@link Pixmap}.</li>
 *   <li>Writes the result as a PNG file to {@code outputPath} via
 *       {@link PixmapIO#writePNG(FileHandle, Pixmap)}.</li>
 *   <li>Signals completion so the main thread can print the summary line.</li>
 * </ol>
 *
 * <p>All work is done inside {@link #create()} so no render loop is required.
 */
public final class DrawingListener extends ApplicationAdapter {

    private final String inputPath;
    private final String outputPath;

    /** Released when all work is finished (success or error). */
    private final CountDownLatch doneLatch = new CountDownLatch(1);

    private volatile String  summary  = "";
    private volatile int     exitCode = 0;

    // -------------------------------------------------------------------------

    public DrawingListener(String inputPath, String outputPath) {
        this.inputPath  = inputPath;
        this.outputPath = outputPath;
    }

    // -------------------------------------------------------------------------
    // ApplicationAdapter life-cycle
    // -------------------------------------------------------------------------

    @Override
    public void create() {
        try {
            runScript();
        } catch (Exception e) {
            System.err.println("ERROR: " + e.getMessage());
            e.printStackTrace(System.err);
            exitCode = 1;
            summary  = "RENDER_FAILED";
        } finally {
            doneLatch.countDown();
            Gdx.app.exit();
        }
    }

    // -------------------------------------------------------------------------
    // Script execution
    // -------------------------------------------------------------------------

    private void runScript() throws IOException {
        FileHandle inputHandle = Gdx.files.absolute(inputPath);
        if (!inputHandle.exists()) {
            throw new IllegalArgumentException("Input file not found: " + inputPath);
        }

        Pixmap pixmap    = null;
        int    drawCount = 0;
        int    pixmapW   = 0;
        int    pixmapH   = 0;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputHandle.read()))) {

            String line;
            int    lineNumber = 0;

            while ((line = reader.readLine()) != null) {
                lineNumber++;
                line = line.trim();

                // Skip blank lines and comments.
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                String[] tokens = line.split("\\s+");
                String   cmd    = tokens[0].toUpperCase();

                switch (cmd) {

                    // ----------------------------------------------------------
                    // SIZE <width> <height>
                    // ----------------------------------------------------------
                    case "SIZE": {
                        if (pixmap != null) {
                            pixmap.dispose();
                            throw new IllegalStateException(
                                    "SIZE must only appear once (line " + lineNumber + ")");
                        }
                        requireTokens(tokens, 3, "SIZE", lineNumber);
                        int w = parsePositiveInt(tokens[1], "width",  lineNumber);
                        int h = parsePositiveInt(tokens[2], "height", lineNumber);
                        pixmap  = new Pixmap(w, h, Format.RGBA8888);
                        pixmapW = w;
                        pixmapH = h;
                        break;
                    }

                    // ----------------------------------------------------------
                    // FILL <r> <g> <b> <a>
                    // ----------------------------------------------------------
                    case "FILL": {
                        requirePixmap(pixmap, lineNumber);
                        requireTokens(tokens, 5, "FILL", lineNumber);
                        float r = toFloat(tokens[1], lineNumber);
                        float g = toFloat(tokens[2], lineNumber);
                        float b = toFloat(tokens[3], lineNumber);
                        float a = toFloat(tokens[4], lineNumber);
                        pixmap.setColor(r, g, b, a);
                        pixmap.fill();
                        drawCount++;
                        break;
                    }

                    // ----------------------------------------------------------
                    // RECT <x> <y> <w> <h> <r> <g> <b> <a>
                    // ----------------------------------------------------------
                    case "RECT": {
                        requirePixmap(pixmap, lineNumber);
                        requireTokens(tokens, 9, "RECT", lineNumber);
                        int   x = parseInt(tokens[1], "x",      lineNumber);
                        int   y = parseInt(tokens[2], "y",      lineNumber);
                        int   w = parseInt(tokens[3], "width",  lineNumber);
                        int   h = parseInt(tokens[4], "height", lineNumber);
                        float r = toFloat(tokens[5], lineNumber);
                        float g = toFloat(tokens[6], lineNumber);
                        float bv= toFloat(tokens[7], lineNumber);
                        float a = toFloat(tokens[8], lineNumber);
                        pixmap.setColor(r, g, bv, a);
                        pixmap.fillRectangle(x, y, w, h);
                        drawCount++;
                        break;
                    }

                    // ----------------------------------------------------------
                    // LINE <x1> <y1> <x2> <y2> <r> <g> <b> <a>
                    // ----------------------------------------------------------
                    case "LINE": {
                        requirePixmap(pixmap, lineNumber);
                        requireTokens(tokens, 9, "LINE", lineNumber);
                        int   x1 = parseInt(tokens[1], "x1", lineNumber);
                        int   y1 = parseInt(tokens[2], "y1", lineNumber);
                        int   x2 = parseInt(tokens[3], "x2", lineNumber);
                        int   y2 = parseInt(tokens[4], "y2", lineNumber);
                        float r  = toFloat(tokens[5], lineNumber);
                        float g  = toFloat(tokens[6], lineNumber);
                        float bv = toFloat(tokens[7], lineNumber);
                        float a  = toFloat(tokens[8], lineNumber);
                        pixmap.setColor(r, g, bv, a);
                        pixmap.drawLine(x1, y1, x2, y2);
                        drawCount++;
                        break;
                    }

                    // ----------------------------------------------------------
                    // CIRCLE <cx> <cy> <radius> <r> <g> <b> <a>
                    // ----------------------------------------------------------
                    case "CIRCLE": {
                        requirePixmap(pixmap, lineNumber);
                        requireTokens(tokens, 8, "CIRCLE", lineNumber);
                        int   cx     = parseInt(tokens[1], "cx",     lineNumber);
                        int   cy     = parseInt(tokens[2], "cy",     lineNumber);
                        int   radius = parseInt(tokens[3], "radius", lineNumber);
                        float r      = toFloat(tokens[4], lineNumber);
                        float g      = toFloat(tokens[5], lineNumber);
                        float bv     = toFloat(tokens[6], lineNumber);
                        float a      = toFloat(tokens[7], lineNumber);
                        pixmap.setColor(r, g, bv, a);
                        pixmap.fillCircle(cx, cy, radius);
                        drawCount++;
                        break;
                    }

                    // ----------------------------------------------------------
                    // PIXEL <x> <y> <r> <g> <b> <a>
                    // ----------------------------------------------------------
                    case "PIXEL": {
                        requirePixmap(pixmap, lineNumber);
                        requireTokens(tokens, 7, "PIXEL", lineNumber);
                        int   x  = parseInt(tokens[1], "x", lineNumber);
                        int   y  = parseInt(tokens[2], "y", lineNumber);
                        float r  = toFloat(tokens[3], lineNumber);
                        float g  = toFloat(tokens[4], lineNumber);
                        float bv = toFloat(tokens[5], lineNumber);
                        float a  = toFloat(tokens[6], lineNumber);
                        pixmap.setColor(r, g, bv, a);
                        pixmap.drawPixel(x, y);
                        drawCount++;
                        break;
                    }

                    default:
                        throw new IllegalArgumentException(
                                "Unknown command '" + cmd + "' at line " + lineNumber);
                }
            }
        }

        if (pixmap == null) {
            throw new IllegalStateException(
                    "No SIZE command found in script; cannot create pixmap.");
        }

        // Write PNG output.
        try {
            FileHandle outputHandle = Gdx.files.absolute(outputPath);
            PixmapIO.writePNG(outputHandle, pixmap);
        } finally {
            pixmap.dispose();
        }

        summary = "RENDER_OK width=" + pixmapW + " height=" + pixmapH
                + " commands=" + drawCount;
    }

    // -------------------------------------------------------------------------
    // Helper methods
    // -------------------------------------------------------------------------

    /** Converts an integer 0–255 token to a normalised [0,1] float. */
    private static float toFloat(String token, int lineNumber) {
        int v = parseInt(token, "color-component", lineNumber);
        if (v < 0 || v > 255) {
            throw new IllegalArgumentException(
                    "Color component " + v + " out of [0,255] range at line " + lineNumber);
        }
        return v / 255.0f;
    }

    private static int parseInt(String token, String name, int lineNumber) {
        try {
            return Integer.parseInt(token);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                    "Expected integer for '" + name + "' but got '" + token
                    + "' at line " + lineNumber);
        }
    }

    private static int parsePositiveInt(String token, String name, int lineNumber) {
        int v = parseInt(token, name, lineNumber);
        if (v <= 0) {
            throw new IllegalArgumentException(
                    "'" + name + "' must be a positive integer but got " + v
                    + " at line " + lineNumber);
        }
        return v;
    }

    private static void requireTokens(String[] tokens, int expected,
                                      String cmd, int lineNumber) {
        if (tokens.length < expected) {
            throw new IllegalArgumentException(
                    cmd + " requires " + (expected - 1) + " argument(s) at line "
                    + lineNumber + " (got " + (tokens.length - 1) + ")");
        }
    }

    private static void requirePixmap(Pixmap pixmap, int lineNumber) {
        if (pixmap == null) {
            throw new IllegalStateException(
                    "SIZE must appear before any drawing command (line " + lineNumber + ")");
        }
    }

    // -------------------------------------------------------------------------
    // Public accessors called by the main thread after awaitDone()
    // -------------------------------------------------------------------------

    /** Blocks until {@link #create()} completes (success or failure). */
    public void awaitDone() throws InterruptedException {
        doneLatch.await();
    }

    public String getSummary()  { return summary;  }
    public int    getExitCode() { return exitCode;  }
}
