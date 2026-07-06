package com.example;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import java.util.concurrent.CountDownLatch;

public class Launcher {
    public static void main(String[] args) {
        String scenarioPath = null;
        String outputPath = null;

        for (int i = 0; i < args.length; i++) {
            if (args[i].equals("--scenario") && i + 1 < args.length) {
                scenarioPath = args[i + 1];
                i++;
            } else if (args[i].equals("--output") && i + 1 < args.length) {
                outputPath = args[i + 1];
                i++;
            }
        }

        if (scenarioPath == null || outputPath == null) {
            System.err.println("Usage: Launcher --scenario <scenario_path> --output <output_path>");
            System.exit(1);
        }

        CountDownLatch latch = new CountDownLatch(1);
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0; // 0 means maximum throughput (never sleep)

        SimulationListener listener = new SimulationListener(scenarioPath, outputPath, latch);
        new HeadlessApplication(listener, config);

        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
