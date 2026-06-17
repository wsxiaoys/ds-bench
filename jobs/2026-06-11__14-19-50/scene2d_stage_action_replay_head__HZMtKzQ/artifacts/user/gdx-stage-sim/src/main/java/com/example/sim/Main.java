package com.example.sim;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public final class Main {

    public static void main(String[] args) {
        if (args.length != 2) {
            System.err.println("Usage: gdx-stage-sim <script-path> <output-path>");
            System.exit(1);
        }

        String scriptPath = args[0];
        String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Tick as fast as possible — simulation is driven by our own dt, not wall-clock.
        config.updatesPerSecond = 0;

        CountDownLatch doneLatch = new CountDownLatch(1);
        SimulationListener listener = new SimulationListener(scriptPath, outputPath, doneLatch);

        new HeadlessApplication(listener, config);

        // HeadlessApplication runs on its own thread. Wait for the simulation to
        // complete and dispose() to signal the latch (which guarantees the output
        // file has been written).
        try {
            if (!doneLatch.await(60, TimeUnit.SECONDS)) {
                System.err.println("Simulation timed out after 60 seconds.");
                System.exit(1);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("Interrupted while waiting for simulation to finish.");
            System.exit(1);
        }
    }
}
