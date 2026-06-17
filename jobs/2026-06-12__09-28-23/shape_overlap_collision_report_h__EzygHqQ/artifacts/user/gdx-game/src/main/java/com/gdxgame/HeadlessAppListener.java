package com.gdxgame;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;

import java.io.*;
import java.util.List;
import java.util.concurrent.CountDownLatch;

/**
 * libGDX ApplicationListener that runs on the headless backend.
 * On the first render tick it loads the shape file, computes overlaps,
 * writes the report, and exits.
 */
public class HeadlessAppListener extends ApplicationAdapter {

    private final String inputPath;
    private final String outputPath;
    private final CountDownLatch exitLatch;
    private boolean done = false;

    public HeadlessAppListener(String inputPath, String outputPath, CountDownLatch exitLatch) {
        this.inputPath = inputPath;
        this.outputPath = outputPath;
        this.exitLatch = exitLatch;
    }

    @Override
    public void render() {
        if (done) {
            return;
        }
        done = true;

        try {
            // Parse input
            FileHandle inputFile = Gdx.files.absolute(inputPath);
            if (!inputFile.exists()) {
                System.err.println("Error: input file not found: " + inputPath);
                exitLatch.countDown();
                System.exit(1);
                return;
            }

            List<Shape> shapes;
            try (Reader reader = inputFile.reader("UTF-8")) {
                shapes = ShapeParser.parse(reader);
            }

            // Compute overlaps
            List<OverlapDetector.OverlapPair> pairs = OverlapDetector.findOverlaps(shapes);

            // Write output
            FileHandle outputFile = Gdx.files.absolute(outputPath);
            try (Writer writer = outputFile.writer(false, "UTF-8")) {
                OutputWriter.write(writer, pairs);
            }

            // Success
            Gdx.app.exit();
            exitLatch.countDown();
        } catch (ShapeParser.ParseException e) {
            System.err.println(e.getMessage());
            exitLatch.countDown();
            System.exit(1);
        } catch (IOException e) {
            System.err.println("Error: I/O error: " + e.getMessage());
            exitLatch.countDown();
            System.exit(1);
        }
    }
}
