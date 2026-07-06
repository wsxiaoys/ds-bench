package com.pochi.pixmaprenderer;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.PixmapIO;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

/**
 * {@link com.badlogic.gdx.ApplicationListener} implementation that runs inside a
 * {@link com.badlogic.gdx.backends.headless.HeadlessApplication} and renders a single
 * pixmap from a previously parsed script.
 *
 * <p>All rendering and file I/O happen on the libGDX thread inside {@link #create()} so
 * that {@link com.badlogic.gdx.backends.headless.HeadlessNativesLoader} has finished
 * loading the natives and JNI-backed {@link Pixmap} calls are safe.</p>
 */
public final class PixmapRendererListener extends ApplicationAdapter {

    /** Lock that {@link #create()} releases once the PNG has been written. */
    private final Object completionLock = new Object();
    /** Signalled once create() finished successfully or with an error. */
    private boolean completed;

    /** Result dimensions (filled in once the pixmap has been created). */
    private int width = -1;
    private int height = -1;
    /** Number of drawing commands processed (excluding {@code SIZE}). */
    private int commandCount;

    /** Set in create() when an unrecoverable error occurs. */
    private Throwable failure;

    private final List<ScriptParser.Command> commands;
    private final Path outputPath;

    public PixmapRendererListener(List<ScriptParser.Command> commands, Path outputPath) {
        this.commands = commands;
        this.outputPath = outputPath;
    }

    /** Block the calling thread until {@link #create()} finishes, then return. */
    public void awaitCompletion() throws InterruptedException {
        synchronized (completionLock) {
            long deadline = System.currentTimeMillis() + 60_000L;
            while (!completed) {
                long remaining = deadline - System.currentTimeMillis();
                if (remaining <= 0) {
                    throw new InterruptedException(
                        "Timed out waiting for headless render to finish");
                }
                completionLock.wait(remaining);
            }
        }
    }

    public int getWidth() {
        return width;
    }

    public int getHeight() {
        return height;
    }

    public int getCommandCount() {
        return commandCount;
    }

    public Throwable getFailure() {
        return failure;
    }

    @Override
    public void create() {
        Pixmap pixmap = null;
        try {
            int[] size = findSizeArgs();
            pixmap = new Pixmap(size[0], size[1], Pixmap.Format.RGBA8888);
            // Use no-blending so FILL/RECT truly overwrite prior content
            // regardless of alpha values.
            pixmap.setBlending(Pixmap.Blending.None);

            for (ScriptParser.Command cmd : commands) {
                applyCommand(pixmap, cmd);
            }

            this.width = pixmap.getWidth();
            this.height = pixmap.getHeight();

            FileHandle out = Gdx.files.absolute(outputPath.toString());
            // Ensure parent directory exists.
            Path parent = outputPath.toAbsolutePath().getParent();
            if (parent != null) {
                java.io.File parentDir = parent.toFile();
                if (!parentDir.exists() && !parentDir.mkdirs() && !parentDir.exists()) {
                    throw new java.io.IOException(
                        "Unable to create output directory " + parentDir);
                }
            }

            PixmapIO.writePNG(out, pixmap);

            // Force any buffered output to hit disk before we exit().
            out.file().getAbsoluteFile();
        } catch (Throwable t) {
            this.failure = t;
        } finally {
            if (pixmap != null) {
                try {
                    pixmap.dispose();
                } catch (Throwable disposeError) {
                    if (failure == null) {
                        failure = disposeError;
                    }
                }
            }
            synchronized (completionLock) {
                completed = true;
                completionLock.notifyAll();
            }
            // Request that the application loop terminate.
            try {
                Gdx.app.exit();
            } catch (Throwable ignored) {
                // Gdx.app may already be shutting down; nothing else to do.
            }
        }
    }

    private int[] findSizeArgs() {
        for (ScriptParser.Command cmd : commands) {
            if (cmd.op == ScriptParser.Op.SIZE) {
                return cmd.args;
            }
        }
        throw new ScriptParser.ScriptParseException(
            "Script must contain a SIZE command", -1);
    }

    private void applyCommand(Pixmap pixmap, ScriptParser.Command cmd) {
        switch (cmd.op) {
            case SIZE:
                // Already handled; nothing to draw but counts as a layout command.
                return;

            case FILL: {
                setColor(pixmap, cmd.args, 0);
                pixmap.fill();
                commandCount++;
                return;
            }

            case RECT: {
                pixmap.setColor(
                    byteNorm(cmd.args[4]),
                    byteNorm(cmd.args[5]),
                    byteNorm(cmd.args[6]),
                    byteNorm(cmd.args[7]));
                pixmap.fillRectangle(cmd.args[0], cmd.args[1], cmd.args[2], cmd.args[3]);
                commandCount++;
                return;
            }

            case LINE: {
                pixmap.setColor(
                    byteNorm(cmd.args[4]),
                    byteNorm(cmd.args[5]),
                    byteNorm(cmd.args[6]),
                    byteNorm(cmd.args[7]));
                pixmap.drawLine(cmd.args[0], cmd.args[1], cmd.args[2], cmd.args[3]);
                commandCount++;
                return;
            }

            case CIRCLE: {
                pixmap.setColor(
                    byteNorm(cmd.args[3]),
                    byteNorm(cmd.args[4]),
                    byteNorm(cmd.args[5]),
                    byteNorm(cmd.args[6]));
                pixmap.fillCircle(cmd.args[0], cmd.args[1], cmd.args[2]);
                commandCount++;
                return;
            }

            case PIXEL: {
                pixmap.setColor(
                    byteNorm(cmd.args[2]),
                    byteNorm(cmd.args[3]),
                    byteNorm(cmd.args[4]),
                    byteNorm(cmd.args[5]));
                pixmap.drawPixel(cmd.args[0], cmd.args[1]);
                commandCount++;
                return;
            }

            default:
                throw new ScriptParser.ScriptParseException(
                    "Unsupported op " + cmd.op + " on line " + cmd.lineNumber,
                    cmd.lineNumber);
        }
    }

    private static float byteNorm(int v) {
        return v / 255f;
    }

    /**
     * Convenience for {@code FILL} which has color components immediately
     * after the opcode (no positional arguments).
     */
    private static void setColor(Pixmap pixmap, int[] args, int offset) {
        pixmap.setColor(
            byteNorm(args[offset]),
            byteNorm(args[offset + 1]),
            byteNorm(args[offset + 2]),
            byteNorm(args[offset + 3]));
    }

    /** Convenience for tests / run.sh callers that prefer path strings. */
    @SuppressWarnings("unused")
    static PixmapRendererListener fromPaths(List<ScriptParser.Command> cmds, String outPath) {
        return new PixmapRendererListener(cmds, Paths.get(outPath));
    }
}
