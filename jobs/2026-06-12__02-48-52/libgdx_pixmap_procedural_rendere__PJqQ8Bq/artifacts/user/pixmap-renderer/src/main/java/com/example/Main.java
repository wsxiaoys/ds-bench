package com.example;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.PixmapIO;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.concurrent.CountDownLatch;

public class Main {
    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: Main <input_file> <output_png>");
            System.exit(1);
        }

        String inputFile = args[0];
        String outputFile = args[1];

        CountDownLatch latch = new CountDownLatch(1);
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        RendererApplication app = new RendererApplication(inputFile, outputFile, latch);
        new HeadlessApplication(app, config);

        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}

class RendererApplication extends ApplicationAdapter {
    private final String inputFile;
    private final String outputFile;
    private final CountDownLatch latch;
    private Pixmap pixmap;

    public RendererApplication(String inputFile, String outputFile, CountDownLatch latch) {
        this.inputFile = inputFile;
        this.outputFile = outputFile;
        this.latch = latch;
    }

    @Override
    public void create() {
        int width = 0;
        int height = 0;
        int commands = 0;

        try (BufferedReader reader = new BufferedReader(new FileReader(inputFile))) {
            String line;
            boolean sizeRead = false;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                String[] tokens = line.split("\\s+");
                String cmd = tokens[0].toUpperCase();

                if (!sizeRead) {
                    if (cmd.equals("SIZE")) {
                        width = Integer.parseInt(tokens[1]);
                        height = Integer.parseInt(tokens[2]);
                        pixmap = new Pixmap(width, height, Pixmap.Format.RGBA8888);
                        sizeRead = true;
                    } else {
                        throw new IllegalStateException("First command must be SIZE");
                    }
                    continue;
                }

                switch (cmd) {
                    case "FILL": {
                        float r = Integer.parseInt(tokens[1]) / 255f;
                        float g = Integer.parseInt(tokens[2]) / 255f;
                        float b = Integer.parseInt(tokens[3]) / 255f;
                        float a = Integer.parseInt(tokens[4]) / 255f;
                        pixmap.setColor(r, g, b, a);
                        pixmap.fill();
                        commands++;
                        break;
                    }
                    case "RECT": {
                        int x = Integer.parseInt(tokens[1]);
                        int y = Integer.parseInt(tokens[2]);
                        int w = Integer.parseInt(tokens[3]);
                        int h = Integer.parseInt(tokens[4]);
                        float r = Integer.parseInt(tokens[5]) / 255f;
                        float g = Integer.parseInt(tokens[6]) / 255f;
                        float b = Integer.parseInt(tokens[7]) / 255f;
                        float a = Integer.parseInt(tokens[8]) / 255f;
                        pixmap.setColor(r, g, b, a);
                        pixmap.fillRectangle(x, y, w, h);
                        commands++;
                        break;
                    }
                    case "LINE": {
                        int x1 = Integer.parseInt(tokens[1]);
                        int y1 = Integer.parseInt(tokens[2]);
                        int x2 = Integer.parseInt(tokens[3]);
                        int y2 = Integer.parseInt(tokens[4]);
                        float r = Integer.parseInt(tokens[5]) / 255f;
                        float g = Integer.parseInt(tokens[6]) / 255f;
                        float b = Integer.parseInt(tokens[7]) / 255f;
                        float a = Integer.parseInt(tokens[8]) / 255f;
                        pixmap.setColor(r, g, b, a);
                        pixmap.drawLine(x1, y1, x2, y2);
                        commands++;
                        break;
                    }
                    case "CIRCLE": {
                        int cx = Integer.parseInt(tokens[1]);
                        int cy = Integer.parseInt(tokens[2]);
                        int radius = Integer.parseInt(tokens[3]);
                        float r = Integer.parseInt(tokens[4]) / 255f;
                        float g = Integer.parseInt(tokens[5]) / 255f;
                        float b = Integer.parseInt(tokens[6]) / 255f;
                        float a = Integer.parseInt(tokens[7]) / 255f;
                        pixmap.setColor(r, g, b, a);
                        pixmap.fillCircle(cx, cy, radius);
                        commands++;
                        break;
                    }
                    case "PIXEL": {
                        int x = Integer.parseInt(tokens[1]);
                        int y = Integer.parseInt(tokens[2]);
                        float r = Integer.parseInt(tokens[3]) / 255f;
                        float g = Integer.parseInt(tokens[4]) / 255f;
                        float b = Integer.parseInt(tokens[5]) / 255f;
                        float a = Integer.parseInt(tokens[6]) / 255f;
                        pixmap.setColor(r, g, b, a);
                        pixmap.drawPixel(x, y);
                        commands++;
                        break;
                    }
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
            Gdx.app.exit();
            latch.countDown();
            return;
        }

        if (pixmap != null) {
            FileHandle fh = Gdx.files.absolute(new java.io.File(outputFile).getAbsolutePath());
            PixmapIO.writePNG(fh, pixmap);
            pixmap.dispose();
            System.out.println("RENDER_OK width=" + width + " height=" + height + " commands=" + commands);
        }

        Gdx.app.exit();
        latch.countDown();
    }
}
