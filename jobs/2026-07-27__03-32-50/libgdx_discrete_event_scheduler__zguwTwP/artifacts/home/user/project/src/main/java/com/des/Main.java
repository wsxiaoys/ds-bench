package com.des;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Entry point. Usage:
 *   run.sh --scenario <scenarioPath> --out <outPath>
 *
 * Runs the deterministic discrete-event simulation inside a libGDX
 * HeadlessApplication, driven entirely by its render/tick loop.
 */
public final class Main {

    public static void main(String[] args) {
        String scenarioArg = null;
        String outArg = null;

        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--scenario":
                    if (i + 1 >= args.length) {
                        fail("Missing value for --scenario");
                    }
                    scenarioArg = args[++i];
                    break;
                case "--out":
                    if (i + 1 >= args.length) {
                        fail("Missing value for --out");
                    }
                    outArg = args[++i];
                    break;
                default:
                    fail("Unrecognized argument: " + args[i]);
            }
        }

        if (scenarioArg == null || outArg == null) {
            fail("Usage: run.sh --scenario <scenarioPath> --out <outPath>");
        }

        Path scenarioPath = Paths.get(scenarioArg);
        Path outPath = Paths.get(outArg);

        CountDownLatch doneLatch = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Run the tick loop as fast as possible (no throttling / sleeping);
        // the loop still calls render() repeatedly, which is what drives the
        // simulation forward one event at a time.
        config.updatesPerSecond = 0;

        SimulationListener listener = new SimulationListener(scenarioPath, outPath, doneLatch, failure);
        new HeadlessApplication(listener, config);

        try {
            doneLatch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        Throwable t = failure.get();
        if (t != null) {
            System.err.println("Simulation failed: " + t.getMessage());
            t.printStackTrace();
            System.exit(1);
        }
        System.exit(0);
    }

    private static void fail(String message) {
        System.err.println(message);
        System.exit(2);
        throw new AssertionError("unreachable");
    }
}
