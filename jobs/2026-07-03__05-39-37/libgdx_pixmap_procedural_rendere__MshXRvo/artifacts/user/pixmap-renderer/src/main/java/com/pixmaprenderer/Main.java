package com.pixmaprenderer;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Pixmap.Format;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Renders a procedural image into a libGDX {@link Pixmap} from a plain-text
 * command script and writes the result to a PNG file via {@link PixmapIO}.
 *
 * All {@link Pixmap} work and the PNG write happen on the libGDX thread
 * (inside {@link #create()}), satisfying the headless back-end's threading
 * contract.
 */
public class Main extends ApplicationAdapter {

    /** Result holder shared with the launcher so it can print the summary line. */
    static final class RenderResult {
        volatile int width;
        volatile int height;
        volatile int commands;
        volatile String error;
    }

    private final String inputPath;
    private final String outputPath;
    private final RenderResult result;

    public Main(String inputPath, String outputPath, RenderResult result) {
        this.inputPath = inputPath;
        this.outputPath = outputPath;
        this.result = result;
    }

    /**
     * Entry point. Boots a {@link HeadlessApplication}, waits for it to finish
     * rendering, then prints the single summary line to stdout.
     *
     * Usage: {@code Main <input-command-file> <output-png-path>}
     */
    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            System.err.println("Usage: Main <input-command-file> <output-png-path>");
            System.exit(2);
        }
        String inputPath = args[0];
        String outputPath = args[1];

        RenderResult result = new RenderResult();
        Main listener = new Main(inputPath, outputPath, result);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // A negative updates-per-second yields a negative render interval, so
        // the headless main loop performs only create()+cleanup and never spins
        // the render loop. We also call Gdx.app.exit() inside create() to be safe.
        config.updatesPerSecond = -1;

        HeadlessApplication app = new HeadlessApplication(listener, config);

        // Block until the headless app's thread terminates so the PNG is fully
        // flushed before we print the summary line.
        Thread appThread = getApplicationThread(app);
        if (appThread != null) {
            appThread.join();
        }

        if (result.error != null) {
            System.err.println("RENDER_ERROR " + result.error);
            System.exit(1);
        }
        System.out.println("RENDER_OK width=" + result.width
                + " height=" + result.height
                + " commands=" + result.commands);
    }

    /**
     * Retrieves the {@link HeadlessApplication}'s worker thread. libGDX stores
     * it in the protected {@code mainLoopThread} field (named
     * "HeadlessApplication"); we read it via reflection and fall back to a
     * name-based thread scan if the field layout changes.
     */
    private static Thread getApplicationThread(HeadlessApplication app) {
        try {
            java.lang.reflect.Field f = HeadlessApplication.class.getDeclaredField("mainLoopThread");
            f.setAccessible(true);
            Object t = f.get(app);
            if (t instanceof Thread) {
                return (Thread) t;
            }
        } catch (ReflectiveOperationException ignored) {
            // fall through to name-based scan
        }
        Thread[] threads = new Thread[Thread.activeCount() * 2 + 16];
        Thread.enumerate(threads);
        for (Thread t : threads) {
            if (t != null && t.getName() != null
                    && t.getName().toLowerCase(java.util.Locale.ROOT).contains("headless")) {
                return t;
            }
        }
        return null;
    }

    @Override
    public void create() {
        Pixmap pixmap = null;
        try {
            List<String> lines = readScript(inputPath);
            pixmap = executeScript(lines);
            FileHandle out = Gdx.files.absolute(outputPath);
            com.badlogic.gdx.graphics.PixmapIO.writePNG(out, pixmap);
            result.width = pixmap.getWidth();
            result.height = pixmap.getHeight();
        } catch (Exception e) {
            result.error = (e.getMessage() == null ? e.toString() : e.getMessage());
            if (pixmap != null) {
                pixmap.dispose();
                pixmap = null;
            }
        } finally {
            if (pixmap != null) {
                pixmap.dispose();
            }
            // Schedule shutdown once the render thread is idle.
            Gdx.app.exit();
        }
    }

    /** Reads the command script into a list of raw lines. */
    private List<String> readScript(String path) throws IOException {
        FileHandle handle = Gdx.files.absolute(path);
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new java.io.InputStreamReader(handle.read(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lines.add(line);
            }
        }
        return lines;
    }

    /**
     * Executes the drawing commands in script order against a single
     * {@link Pixmap}. Returns the (still undisposed) pixmap so the caller can
     * flush it and then dispose it.
     */
    private Pixmap executeScript(List<String> lines) {
        Pixmap pixmap = null;
        int commandCount = 0;
        boolean sizeSeen = false;

        for (int i = 0; i < lines.size(); i++) {
            String raw = lines.get(i);
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            String[] tok = line.split("\\s+");
            String cmd = tok[0].toUpperCase(java.util.Locale.ROOT);

            if (cmd.equals("SIZE")) {
                if (sizeSeen) {
                    throw new IllegalStateException("SIZE must appear only once (line " + (i + 1) + ")");
                }
                if (tok.length != 3) {
                    throw new IllegalArgumentException("SIZE expects <width> <height> (line " + (i + 1) + ")");
                }
                int width = Integer.parseInt(tok[1]);
                int height = Integer.parseInt(tok[2]);
                if (width <= 0 || height <= 0) {
                    throw new IllegalArgumentException("SIZE dimensions must be positive (line " + (i + 1) + ")");
                }
                pixmap = new Pixmap(width, height, Format.RGBA8888);
                sizeSeen = true;
                continue;
            }

            if (!sizeSeen) {
                throw new IllegalStateException("SIZE must be the first non-comment, non-blank line (line " + (i + 1) + ")");
            }

            switch (cmd) {
                case "FILL": {
                    int[] c = requireInts(tok, 5, i + 1);
                    pixmap.setColor(norm(c[1]), norm(c[2]), norm(c[3]), norm(c[4]));
                    pixmap.fill();
                    break;
                }
                case "RECT": {
                    int[] c = requireInts(tok, 9, i + 1);
                    pixmap.setColor(norm(c[5]), norm(c[6]), norm(c[7]), norm(c[8]));
                    pixmap.fillRectangle(c[1], c[2], c[3], c[4]);
                    break;
                }
                case "LINE": {
                    int[] c = requireInts(tok, 9, i + 1);
                    pixmap.setColor(norm(c[5]), norm(c[6]), norm(c[7]), norm(c[8]));
                    pixmap.drawLine(c[1], c[2], c[3], c[4]);
                    break;
                }
                case "CIRCLE": {
                    int[] c = requireInts(tok, 8, i + 1);
                    pixmap.setColor(norm(c[4]), norm(c[5]), norm(c[6]), norm(c[7]));
                    pixmap.fillCircle(c[1], c[2], c[3]);
                    break;
                }
                case "PIXEL": {
                    int[] c = requireInts(tok, 7, i + 1);
                    pixmap.setColor(norm(c[3]), norm(c[4]), norm(c[5]), norm(c[6]));
                    pixmap.drawPixel(c[1], c[2]);
                    break;
                }
                default:
                    throw new IllegalArgumentException("Unknown command '" + cmd + "' (line " + (i + 1) + ")");
            }
            commandCount++;
        }

        if (pixmap == null) {
            throw new IllegalStateException("No SIZE command found in script");
        }
        result.commands = commandCount;
        return pixmap;
    }

    /** Parses {@code expected} int tokens (cmd at index 0) and returns them. */
    private static int[] requireInts(String[] tok, int expected, int lineNo) {
        if (tok.length != expected) {
            throw new IllegalArgumentException(
                    "Command " + tok[0] + " expects " + (expected - 1) + " arguments (line " + lineNo + ")");
        }
        int[] vals = new int[expected];
        vals[0] = -1; // unused cmd slot
        for (int k = 1; k < expected; k++) {
            try {
                vals[k] = Integer.parseInt(tok[k]);
            } catch (NumberFormatException nfe) {
                throw new IllegalArgumentException(
                        "Non-integer argument '" + tok[k] + "' (line " + lineNo + ")", nfe);
            }
        }
        return vals;
    }

    /** Converts a 0–255 component to a normalized float in [0, 1]. */
    private static float norm(int v) {
        if (v < 0) v = 0;
        if (v > 255) v = 255;
        return v / 255f;
    }
}