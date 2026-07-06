package com.example.gdxgame;

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
            System.exit(2);
        }

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        final CollisionListener listener = new CollisionListener(shapesPath, outputPath);
        HeadlessApplication app = new HeadlessApplication(listener, config);

        // Wait for the headless main loop to finish (the listener calls Gdx.app.exit()).
        // The headless application runs its main loop on its own thread; we keep main alive until then.
        while (!listener.finished) {
            try {
                Thread.sleep(10);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        // Allow log/error queues to drain.
        try {
            Thread.sleep(50);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        app.exit();
        System.exit(listener.exitCode);
    }
}
