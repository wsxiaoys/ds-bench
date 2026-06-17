package com.example.sim;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import java.util.concurrent.CountDownLatch;

public class SimulationLauncher {
    public static void main(String[] args) throws InterruptedException {
        String scenarioPath = null;
        String outputPath = null;

        for (int i = 0; i < args.length; i++) {
            if ("--scenario".equals(args[i]) && i + 1 < args.length) {
                scenarioPath = args[i + 1];
            } else if ("--output".equals(args[i]) && i + 1 < args.length) {
                outputPath = args[i + 1];
            }
        }

        if (scenarioPath == null || outputPath == null) {
            System.err.println("Missing arguments");
            System.exit(1);
        }

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        CountDownLatch latch = new CountDownLatch(1);
        Simulation simulation = new Simulation(scenarioPath, outputPath, latch);
        new HeadlessApplication(simulation, config);
        latch.await();
    }
}
