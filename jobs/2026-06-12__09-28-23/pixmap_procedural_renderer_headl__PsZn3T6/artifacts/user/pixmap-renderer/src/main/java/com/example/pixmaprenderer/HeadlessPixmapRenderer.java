package com.example.pixmaprenderer;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.PixmapIO;

public final class HeadlessPixmapRenderer {
    private HeadlessPixmapRenderer() {
    }

    public static void main(String[] args) throws InterruptedException {
        if (args.length != 2) {
            System.err.println("Usage: run.sh <input_file> <output_png>");
            System.exit(2);
            return;
        }

        RendererApplication listener = new RendererApplication(args[0], args[1]);
        JoinableHeadlessApplication application = new JoinableHeadlessApplication(
                listener,
                new HeadlessApplicationConfiguration());

        application.joinMainLoopThread();

        Throwable failure = listener.getFailure();
        if (failure != null) {
            System.err.println(failure.getMessage() == null ? failure.toString() : failure.getMessage());
            System.exit(1);
            return;
        }

        RenderSummary summary = listener.getSummary();
        if (summary == null) {
            System.err.println("Rendering finished without producing a summary");
            System.exit(1);
            return;
        }

        System.out.println("RENDER_OK width=" + summary.width
                + " height=" + summary.height
                + " commands=" + summary.commandCount);
    }

    private static final class JoinableHeadlessApplication extends HeadlessApplication {
        private JoinableHeadlessApplication(ApplicationAdapter listener, HeadlessApplicationConfiguration config) {
            super(listener, config);
        }

        private void joinMainLoopThread() throws InterruptedException {
            if (mainLoopThread != null) {
                mainLoopThread.join();
            }
        }
    }

    private static final class RendererApplication extends ApplicationAdapter {
        private final String inputPath;
        private final String outputPath;
        private Pixmap pixmap;
        private RenderSummary summary;
        private Throwable failure;

        private RendererApplication(String inputPath, String outputPath) {
            this.inputPath = inputPath;
            this.outputPath = outputPath;
        }

        @Override
        public void create() {
            try {
                renderScript();
            } catch (Throwable t) {
                failure = t;
            } finally {
                disposePixmap();
                Gdx.app.exit();
            }
        }

        @Override
        public void dispose() {
            disposePixmap();
        }

        private Throwable getFailure() {
            return failure;
        }

        private RenderSummary getSummary() {
            return summary;
        }

        private void renderScript() {
            FileHandle inputHandle = Gdx.files.absolute(inputPath);
            String[] lines = inputHandle.readString("UTF-8").split("\\R", -1);

            boolean sawSize = false;
            int width = 0;
            int height = 0;
            int commandCount = 0;

            for (int i = 0; i < lines.length; i++) {
                String line = lines[i].trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                String[] tokens = line.split("\\s+");
                String command = tokens[0];
                int lineNumber = i + 1;

                if (!sawSize) {
                    if (!"SIZE".equals(command)) {
                        throw parseError(lineNumber, "first command must be SIZE");
                    }
                    requireTokenCount(tokens, 3, lineNumber, "SIZE");
                    width = parsePositiveInt(tokens[1], lineNumber, "width");
                    height = parsePositiveInt(tokens[2], lineNumber, "height");
                    pixmap = new Pixmap(width, height, Pixmap.Format.RGBA8888);
                    sawSize = true;
                    continue;
                }

                if ("SIZE".equals(command)) {
                    throw parseError(lineNumber, "SIZE may only appear once as the first command");
                }

                executeDrawingCommand(tokens, lineNumber);
                commandCount++;
            }

            if (!sawSize) {
                throw new IllegalArgumentException("Input script does not contain a SIZE command");
            }

            FileHandle outputHandle = Gdx.files.absolute(outputPath);
            outputHandle.parent().mkdirs();
            PixmapIO.writePNG(outputHandle, pixmap);
            summary = new RenderSummary(width, height, commandCount);
        }

        private void executeDrawingCommand(String[] tokens, int lineNumber) {
            String command = tokens[0];
            if ("FILL".equals(command)) {
                requireTokenCount(tokens, 5, lineNumber, command);
                setColor(tokens, 1, lineNumber);
                pixmap.fill();
            } else if ("RECT".equals(command)) {
                requireTokenCount(tokens, 9, lineNumber, command);
                int x = parseInt(tokens[1], lineNumber, "x");
                int y = parseInt(tokens[2], lineNumber, "y");
                int w = parseInt(tokens[3], lineNumber, "w");
                int h = parseInt(tokens[4], lineNumber, "h");
                setColor(tokens, 5, lineNumber);
                pixmap.fillRectangle(x, y, w, h);
            } else if ("LINE".equals(command)) {
                requireTokenCount(tokens, 9, lineNumber, command);
                int x1 = parseInt(tokens[1], lineNumber, "x1");
                int y1 = parseInt(tokens[2], lineNumber, "y1");
                int x2 = parseInt(tokens[3], lineNumber, "x2");
                int y2 = parseInt(tokens[4], lineNumber, "y2");
                setColor(tokens, 5, lineNumber);
                pixmap.drawLine(x1, y1, x2, y2);
            } else if ("CIRCLE".equals(command)) {
                requireTokenCount(tokens, 8, lineNumber, command);
                int cx = parseInt(tokens[1], lineNumber, "cx");
                int cy = parseInt(tokens[2], lineNumber, "cy");
                int radius = parseInt(tokens[3], lineNumber, "radius");
                setColor(tokens, 4, lineNumber);
                pixmap.fillCircle(cx, cy, radius);
            } else if ("PIXEL".equals(command)) {
                requireTokenCount(tokens, 7, lineNumber, command);
                int x = parseInt(tokens[1], lineNumber, "x");
                int y = parseInt(tokens[2], lineNumber, "y");
                setColor(tokens, 3, lineNumber);
                pixmap.drawPixel(x, y);
            } else {
                throw parseError(lineNumber, "unknown command: " + command);
            }
        }

        private void setColor(String[] tokens, int offset, int lineNumber) {
            int r = parseColor(tokens[offset], lineNumber, "r");
            int g = parseColor(tokens[offset + 1], lineNumber, "g");
            int b = parseColor(tokens[offset + 2], lineNumber, "b");
            int a = parseColor(tokens[offset + 3], lineNumber, "a");
            pixmap.setColor(r / 255f, g / 255f, b / 255f, a / 255f);
        }

        private static void requireTokenCount(String[] tokens, int expected, int lineNumber, String command) {
            if (tokens.length != expected) {
                throw parseError(lineNumber, command + " expects " + (expected - 1)
                        + " arguments, got " + (tokens.length - 1));
            }
        }

        private static int parsePositiveInt(String token, int lineNumber, String name) {
            int value = parseInt(token, lineNumber, name);
            if (value <= 0) {
                throw parseError(lineNumber, name + " must be a positive integer");
            }
            return value;
        }

        private static int parseColor(String token, int lineNumber, String name) {
            int value = parseInt(token, lineNumber, name);
            if (value < 0 || value > 255) {
                throw parseError(lineNumber, name + " must be in the range 0-255");
            }
            return value;
        }

        private static int parseInt(String token, int lineNumber, String name) {
            try {
                return Integer.parseInt(token);
            } catch (NumberFormatException e) {
                throw parseError(lineNumber, name + " must be an integer");
            }
        }

        private static IllegalArgumentException parseError(int lineNumber, String message) {
            return new IllegalArgumentException("Line " + lineNumber + ": " + message);
        }

        private void disposePixmap() {
            if (pixmap != null) {
                pixmap.dispose();
                pixmap = null;
            }
        }
    }

    private static final class RenderSummary {
        private final int width;
        private final int height;
        private final int commandCount;

        private RenderSummary(int width, int height, int commandCount) {
            this.width = width;
            this.height = height;
            this.commandCount = commandCount;
        }
    }
}
