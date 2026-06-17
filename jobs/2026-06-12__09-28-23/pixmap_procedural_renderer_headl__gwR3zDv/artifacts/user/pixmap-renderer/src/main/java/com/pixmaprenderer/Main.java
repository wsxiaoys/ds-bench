package com.pixmaprenderer;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;

public class Main {

    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: pixmap-renderer <input_file> <output_png>");
            System.exit(1);
        }

        String inputPath = args[0];
        String outputPath = args[1];

        // Read the input file before booting libGDX
        String inputContent;
        try {
            inputContent = new String(Files.readAllBytes(Paths.get(inputPath)));
        } catch (IOException e) {
            System.err.println("ERROR: Cannot read input file: " + inputPath);
            e.printStackTrace(System.err);
            System.exit(1);
            return;
        }

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        HeadlessPixmapRenderer listener = new HeadlessPixmapRenderer(inputContent, outputPath);

        // HeadlessApplication starts a non-daemon thread; the JVM stays alive
        // until the listener calls Gdx.app.exit(), which causes the main loop
        // to break, call dispose(), and return.
        new HeadlessApplication(listener, config);
    }
}
