package com.pixmap.renderer;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.PixmapIO;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.concurrent.CountDownLatch;

public class PixmapRenderer extends ApplicationAdapter {

    private final String inputPath;
    private final String outputPath;
    private final CountDownLatch latch = new CountDownLatch(1);

    // Results set after processing
    private int width = 0;
    private int height = 0;
    private int commandCount = 0;

    public PixmapRenderer(String inputPath, String outputPath) {
        this.inputPath = inputPath;
        this.outputPath = outputPath;
    }

    @Override
    public void create() {
        FileHandle inputFile = Gdx.files.absolute(inputPath);
        Pixmap pixmap = null;

        try (BufferedReader reader = new BufferedReader(inputFile.reader())) {
            String line;
            boolean sizeSet = false;

            while ((line = reader.readLine()) != null) {
                line = line.trim();
                // Skip blank lines and comments
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                String[] tokens = line.split("\\s+");
                String cmd = tokens[0].toUpperCase();

                switch (cmd) {
                    case "SIZE": {
                        if (tokens.length != 3) {
                            throw new IllegalArgumentException("SIZE requires 2 arguments: width height");
                        }
                        width = Integer.parseInt(tokens[1]);
                        height = Integer.parseInt(tokens[2]);
                        pixmap = new Pixmap(width, height, Pixmap.Format.RGBA8888);
                        sizeSet = true;
                        break;
                    }
                    case "FILL": {
                        if (!sizeSet) throw new IllegalStateException("SIZE must be the first command");
                        if (tokens.length != 5) {
                            throw new IllegalArgumentException("FILL requires 4 arguments: r g b a");
                        }
                        int r = Integer.parseInt(tokens[1]);
                        int g = Integer.parseInt(tokens[2]);
                        int b = Integer.parseInt(tokens[3]);
                        int a = Integer.parseInt(tokens[4]);
                        pixmap.setColor(r / 255f, g / 255f, b / 255f, a / 255f);
                        pixmap.fill();
                        commandCount++;
                        break;
                    }
                    case "RECT": {
                        if (!sizeSet) throw new IllegalStateException("SIZE must be the first command");
                        if (tokens.length != 9) {
                            throw new IllegalArgumentException("RECT requires 8 arguments: x y w h r g b a");
                        }
                        int x = Integer.parseInt(tokens[1]);
                        int y = Integer.parseInt(tokens[2]);
                        int w = Integer.parseInt(tokens[3]);
                        int h = Integer.parseInt(tokens[4]);
                        int r = Integer.parseInt(tokens[5]);
                        int g = Integer.parseInt(tokens[6]);
                        int b = Integer.parseInt(tokens[7]);
                        int a = Integer.parseInt(tokens[8]);
                        pixmap.setColor(r / 255f, g / 255f, b / 255f, a / 255f);
                        pixmap.fillRectangle(x, y, w, h);
                        commandCount++;
                        break;
                    }
                    case "LINE": {
                        if (!sizeSet) throw new IllegalStateException("SIZE must be the first command");
                        if (tokens.length != 8) {
                            throw new IllegalArgumentException("LINE requires 7 arguments: x1 y1 x2 y2 r g b a");
                        }
                        int x1 = Integer.parseInt(tokens[1]);
                        int y1 = Integer.parseInt(tokens[2]);
                        int x2 = Integer.parseInt(tokens[3]);
                        int y2 = Integer.parseInt(tokens[4]);
                        int r = Integer.parseInt(tokens[5]);
                        int g = Integer.parseInt(tokens[6]);
                        int b = Integer.parseInt(tokens[7]);
                        int a = Integer.parseInt(tokens[8]);
                        pixmap.setColor(r / 255f, g / 255f, b / 255f, a / 255f);
                        pixmap.drawLine(x1, y1, x2, y2);
                        commandCount++;
                        break;
                    }
                    case "CIRCLE": {
                        if (!sizeSet) throw new IllegalStateException("SIZE must be the first command");
                        if (tokens.length != 7) {
                            throw new IllegalArgumentException("CIRCLE requires 6 arguments: cx cy radius r g b a");
                        }
                        int cx = Integer.parseInt(tokens[1]);
                        int cy = Integer.parseInt(tokens[2]);
                        int radius = Integer.parseInt(tokens[3]);
                        int r = Integer.parseInt(tokens[4]);
                        int g = Integer.parseInt(tokens[5]);
                        int b = Integer.parseInt(tokens[6]);
                        int a = Integer.parseInt(tokens[7]);
                        pixmap.setColor(r / 255f, g / 255f, b / 255f, a / 255f);
                        pixmap.fillCircle(cx, cy, radius);
                        commandCount++;
                        break;
                    }
                    case "PIXEL": {
                        if (!sizeSet) throw new IllegalStateException("SIZE must be the first command");
                        if (tokens.length != 6) {
                            throw new IllegalArgumentException("PIXEL requires 5 arguments: x y r g b a");
                        }
                        int x = Integer.parseInt(tokens[1]);
                        int y = Integer.parseInt(tokens[2]);
                        int r = Integer.parseInt(tokens[3]);
                        int g = Integer.parseInt(tokens[4]);
                        int b = Integer.parseInt(tokens[5]);
                        int a = Integer.parseInt(tokens[6]);
                        pixmap.setColor(r / 255f, g / 255f, b / 255f, a / 255f);
                        pixmap.drawPixel(x, y);
                        commandCount++;
                        break;
                    }
                    default:
                        throw new IllegalArgumentException("Unknown command: " + cmd);
                }
            }

            if (pixmap == null) {
                throw new IllegalStateException("No SIZE command found in input file");
            }

            // Write the pixmap to PNG
            FileHandle outputFile = Gdx.files.absolute(outputPath);
            PixmapIO.writePNG(outputFile, pixmap);

        } catch (IOException e) {
            throw new RuntimeException("Failed to read input file: " + inputPath, e);
        } finally {
            if (pixmap != null) {
                pixmap.dispose();
            }
        }

        // Signal that rendering is complete
        latch.countDown();

        // Signal the headless application to exit
        Gdx.app.exit();
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

    public CountDownLatch getLatch() {
        return latch;
    }

    public static void main(String[] args) throws InterruptedException {
        if (args.length != 2) {
            System.err.println("Usage: PixmapRenderer <input_file> <output_png>");
            System.exit(1);
        }

        String inputPath = args[0];
        String outputPath = args[1];

        PixmapRenderer renderer = new PixmapRenderer(inputPath, outputPath);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        HeadlessApplication app = new HeadlessApplication(renderer, config);

        // Wait for the rendering work to complete
        renderer.getLatch().await();

        // Give the application a moment to fully shut down
        Thread.sleep(500);

        // Print the summary line
        System.out.println("RENDER_OK width=" + renderer.getWidth()
                + " height=" + renderer.getHeight()
                + " commands=" + renderer.getCommandCount());
    }
}