package com.simulation;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.util.concurrent.CountDownLatch;

/**
 * Entry point for the projectile-physics simulation.
 *
 * <p>Usage:
 * <pre>
 *   java -cp ... com.simulation.ProjectileLauncher --scenario &lt;path&gt; --output &lt;path&gt;
 * </pre>
 *
 * <p>The launcher boots a {@link HeadlessApplication} on its own internal
 * thread and then {@link CountDownLatch#await() awaits} completion so the JVM
 * does not exit while the output file is still being written.
 */
public class ProjectileLauncher {

    public static void main(String[] args) throws InterruptedException {
        String scenarioPath = null;
        String outputPath   = null;

        for (int i = 0; i < args.length - 1; i++) {
            switch (args[i]) {
                case "--scenario":
                    scenarioPath = args[++i];
                    break;
                case "--output":
                    outputPath = args[++i];
                    break;
            }
        }

        if (scenarioPath == null || outputPath == null) {
            System.err.println("Usage: ProjectileLauncher --scenario <path> --output <path>");
            System.exit(1);
        }

        // The latch is released inside SimulationListener.dispose() after the
        // writer has been flushed and closed.
        CountDownLatch doneLatch = new CountDownLatch(1);

        SimulationListener listener = new SimulationListener(scenarioPath, outputPath, doneLatch);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // updatesPerSecond = 0 → maximum throughput (no sleep between ticks).
        config.updatesPerSecond = 0;

        // HeadlessApplication spins up its own render thread; the constructor
        // returns immediately.
        new HeadlessApplication(listener, config);

        // Block here until dispose() signals completion.
        doneLatch.await();
    }
}
