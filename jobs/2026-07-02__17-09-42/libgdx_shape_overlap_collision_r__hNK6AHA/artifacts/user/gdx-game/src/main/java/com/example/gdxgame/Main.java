package com.example.gdxgame;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {

    public static void main(String[] args) {
        String shapesPath = null;
        String outputPath = null;

        for (String arg : args) {
            if (arg.startsWith("--shapes=")) {
                shapesPath = arg.substring("--shapes=".length());
            } else if (arg.startsWith("--output=")) {
                outputPath = arg.substring("--output=".length());
            }
        }

        if (shapesPath == null || outputPath == null) {
            System.err.println("Usage: gdx-game --shapes=<input_path> --output=<output_path>");
            System.exit(2);
            return;
        }

        CountDownLatch latch = new CountDownLatch(1);
        AtomicInteger exitCode = new AtomicInteger(1);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        HeadlessApplication app = new HeadlessApplication(
                new HeadlessListener(shapesPath, outputPath, latch, exitCode), config);

        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("Error: interrupted while waiting for headless application");
            System.exit(1);
            return;
        }

        System.exit(exitCode.get());
    }
}
