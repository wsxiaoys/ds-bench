package com.example.pixmap;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.PixmapIO;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.util.concurrent.CountDownLatch;

public class Main {
    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: <input-file> <output-file>");
            System.exit(1);
        }
        String inputPath = args[0];
        String outputPath = args[1];

        CountDownLatch latch = new CountDownLatch(1);
        RendererListener listener = new RendererListener(inputPath, outputPath, latch);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();

        // Start HeadlessApplication
        new HeadlessApplication(listener, config);

        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("Application interrupted");
            System.exit(1);
        }

        joinHeadlessThread();

        if (listener.getError() != null) {
            System.err.println("Error during rendering: " + listener.getError().getMessage());
            listener.getError().printStackTrace();
            System.exit(1);
        }

        // Print exactly one summary line to stdout
        System.out.println("RENDER_OK width=" + listener.getWidth() + " height=" + listener.getHeight() + " commands=" + listener.getCommandCount());
        System.exit(0);
    }

    private static void joinHeadlessThread() {
        long startTime = System.currentTimeMillis();
        while (System.currentTimeMillis() - startTime < 5000) { // 5s max wait
            Thread headlessThread = null;
            Thread[] threads = new Thread[Thread.activeCount() * 2];
            int count = Thread.enumerate(threads);
            for (int i = 0; i < count; i++) {
                if (threads[i] != null && "HeadlessApplication".equals(threads[i].getName())) {
                    headlessThread = threads[i];
                    break;
                }
            }
            if (headlessThread != null) {
                try {
                    headlessThread.join(100);
                    if (!headlessThread.isAlive()) {
                        break;
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            } else {
                // If thread is not found, it might have already finished
                break;
            }
        }
    }

    private static class RendererListener extends ApplicationAdapter {
        private final String inputPath;
        private final String outputPath;
        private final CountDownLatch latch;

        private int width = 0;
        private int height = 0;
        private int commandCount = 0;
        private Throwable error = null;

        public RendererListener(String inputPath, String outputPath, CountDownLatch latch) {
            this.inputPath = inputPath;
            this.outputPath = outputPath;
            this.latch = latch;
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

        public Throwable getError() {
            return error;
        }

        @Override
        public void create() {
            Pixmap pixmap = null;
            try {
                File absoluteInputFile = new File(inputPath).getAbsoluteFile();
                FileHandle inputHandle = Gdx.files.absolute(absoluteInputFile.getPath());

                if (!inputHandle.exists()) {
                    throw new IllegalArgumentException("Input file does not exist: " + inputPath);
                }

                File absoluteOutputFile = new File(outputPath).getAbsoluteFile();
                FileHandle outputHandle = Gdx.files.absolute(absoluteOutputFile.getPath());

                try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputHandle.read()))) {
                    String line;
                    boolean sizeSet = false;

                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) {
                            continue;
                        }

                        String[] tokens = line.split("\\s+");
                        String cmd = tokens[0].toUpperCase();

                        if (!sizeSet) {
                            if (!"SIZE".equals(cmd)) {
                                throw new IllegalStateException("First command must be SIZE");
                            }
                            if (tokens.length < 3) {
                                throw new IllegalArgumentException("SIZE command requires width and height");
                            }
                            width = Integer.parseInt(tokens[1]);
                            height = Integer.parseInt(tokens[2]);
                            if (width <= 0 || height <= 0) {
                                throw new IllegalArgumentException("Width and height must be positive integers");
                            }
                            pixmap = new Pixmap(width, height, Pixmap.Format.RGBA8888);
                            sizeSet = true;
                            continue;
                        }

                        // Process drawing commands
                        switch (cmd) {
                            case "FILL": {
                                if (tokens.length < 5) {
                                    throw new IllegalArgumentException("FILL command requires r, g, b, a");
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
                                if (tokens.length < 9) {
                                    throw new IllegalArgumentException("RECT command requires x, y, w, h, r, g, b, a");
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
                                if (tokens.length < 9) {
                                    throw new IllegalArgumentException("LINE command requires x1, y1, x2, y2, r, g, b, a");
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
                                if (tokens.length < 8) {
                                    throw new IllegalArgumentException("CIRCLE command requires cx, cy, radius, r, g, b, a");
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
                                if (tokens.length < 7) {
                                    throw new IllegalArgumentException("PIXEL command requires x, y, r, g, b, a");
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

                    if (!sizeSet) {
                        throw new IllegalStateException("No SIZE command found in input file");
                    }
                }

                // Write the final pixmap to PNG
                PixmapIO.writePNG(outputHandle, pixmap);

            } catch (Throwable t) {
                error = t;
            } finally {
                if (pixmap != null) {
                    pixmap.dispose();
                }
                Gdx.app.exit();
            }
        }

        @Override
        public void dispose() {
            latch.countDown();
        }
    }
}
