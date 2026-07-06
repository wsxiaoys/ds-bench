package com.example.gdxstagesim;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.util.concurrent.CountDownLatch;

/**
 * Entry point for the headless Scene2D action-replay simulator.
 *
 * <p>Usage: {@code ./gradlew run --args="<script-path> <output-path>"}</p>
 *
 * <p>This boots a {@link HeadlessApplication} (no OpenGL context) driving an
 * {@link com.badlogic.gdx.ApplicationListener}. The simulation runs on the
 * headless main-loop thread; {@code main} blocks on a {@link CountDownLatch}
 * that is released from inside {@code dispose()} so the output file is
 * guaranteed to be flushed before the JVM exits.</p>
 */
public class Main {

    public static void main(String[] args) throws InterruptedException {
        if (args.length < 2) {
            System.err.println("Usage: gdx-stage-sim <script-path> <output-path>");
            System.exit(1);
        }
        String scriptPath = args[0];
        String outputPath = args[1];

        CountDownLatch latch = new CountDownLatch(1);
        SceneSimApplication listener = new SceneSimApplication(scriptPath, outputPath, latch);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // 0 = run the loop as fast as possible (no wall-clock throttling).
        config.updatesPerSecond = 0;

        // Constructing HeadlessApplication starts the main-loop thread immediately.
        new HeadlessApplication(listener, config);

        // Block until dispose() releases the latch, guaranteeing the output file
        // has been written and flushed before the JVM terminates.
        latch.await();
    }
}