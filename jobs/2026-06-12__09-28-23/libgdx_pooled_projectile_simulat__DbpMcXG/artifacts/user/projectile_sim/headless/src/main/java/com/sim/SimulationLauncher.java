package com.sim;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import java.util.concurrent.CountDownLatch;

public class SimulationLauncher {
    public static void main(String[] args) {
        String scenarioPath = null;
        String outputPath = null;

        for (int i = 0; i < args.length; i++) {
            if ("--scenario".equals(args[i]) && i + 1 < args.length) {
                scenarioPath = args[i + 1];
                i++;
            } else if ("--output".equals(args[i]) && i + 1 < args.length) {
                outputPath = args[i + 1];
                i++;
            }
        }

        if (scenarioPath == null || outputPath == null) {
            System.err.println("Usage: --scenario <scenario_path> --output <output_path>");
            System.exit(1);
        }

        CountDownLatch latch = new CountDownLatch(1);
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0; // maximum throughput

        SimulationListener listener = new SimulationListener(scenarioPath, outputPath, latch);
        new HeadlessApplication(listener, config);

        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("Simulation interrupted");
        }
    }
}
