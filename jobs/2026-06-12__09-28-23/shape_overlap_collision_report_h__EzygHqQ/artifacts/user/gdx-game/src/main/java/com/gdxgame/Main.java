package com.gdxgame;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.util.concurrent.CountDownLatch;

/**
 * Entry point. Parses --shapes=<path> and --output=<path> arguments,
 * boots a HeadlessApplication with our listener, and waits for it to finish.
 */
public class Main {

    public static void main(String[] args) {
        String inputPath = null;
        String outputPath = null;

        for (String arg : args) {
            if (arg.startsWith("--shapes=")) {
                inputPath = arg.substring("--shapes=".length());
            } else if (arg.startsWith("--output=")) {
                outputPath = arg.substring("--output=".length());
            }
        }

        if (inputPath == null || outputPath == null) {
            System.err.println("Usage: gdx-game --shapes=<input_path> --output=<output_path>");
            System.exit(1);
            return;
        }

        CountDownLatch exitLatch = new CountDownLatch(1);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0; // don't busy-wait

        new HeadlessApplication(
                new HeadlessAppListener(inputPath, outputPath, exitLatch),
                config
        );

        // Wait for the listener to signal completion via the latch.
        try {
            exitLatch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("Error: interrupted while waiting for completion");
            System.exit(1);
        }
    }
}
