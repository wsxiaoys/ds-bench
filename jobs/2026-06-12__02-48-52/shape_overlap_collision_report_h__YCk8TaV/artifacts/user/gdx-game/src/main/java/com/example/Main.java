package com.example;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

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
            System.exit(1);
        }

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        ShapeOverlapApp app = new ShapeOverlapApp(shapesPath, outputPath);
        new HeadlessApplication(app, config);

        try {
            app.latch.await();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        
        System.exit(app.exitCode);
    }
}