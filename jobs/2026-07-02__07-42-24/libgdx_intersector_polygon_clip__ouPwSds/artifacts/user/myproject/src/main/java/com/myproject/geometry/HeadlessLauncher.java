package com.myproject.geometry;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import java.util.concurrent.CountDownLatch;

public class HeadlessLauncher {
    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Error: Missing script file argument.");
            System.exit(1);
        }
        String scriptPath = args[0];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0; // Tick once and exit

        CountDownLatch latch = new CountDownLatch(1);
        GeometryApp app = new GeometryApp(scriptPath, latch);
        new HeadlessApplication(app, config);

        // Wait for the application to signal completion
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // Join the main loop thread cleanly
        Thread[] threads = new Thread[Thread.activeCount() * 2];
        int count = Thread.enumerate(threads);
        for (int i = 0; i < count; i++) {
            if (threads[i] != null && "HeadlessApplication".equals(threads[i].getName())) {
                try {
                    threads[i].join();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                break;
            }
        }
    }
}
