package com.mygame;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.lang.reflect.Field;

public class Main {
    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: Main <scenario_file_path>");
            System.exit(1);
        }

        String scenarioPath = args[0];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60;

        MyGameListener listener = new MyGameListener(scenarioPath);
        HeadlessApplication app = new HeadlessApplication(listener, config);

        Thread mainLoopThread = null;

        // Try reflection first
        try {
            Field field = HeadlessApplication.class.getDeclaredField("mainLoopThread");
            field.setAccessible(true);
            mainLoopThread = (Thread) field.get(app);
        } catch (Exception e) {
            // Fallback: search by name
        }

        if (mainLoopThread == null) {
            for (int i = 0; i < 10; i++) {
                for (Thread t : Thread.getAllStackTraces().keySet()) {
                    if (t.getName().contains("HeadlessApplication")) {
                        mainLoopThread = t;
                        break;
                    }
                }
                if (mainLoopThread != null) {
                    break;
                }
                try {
                    Thread.sleep(10);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        if (mainLoopThread != null) {
            try {
                mainLoopThread.join();
            } catch (InterruptedException e) {
                System.err.println("Main thread interrupted while waiting for HeadlessApplication thread.");
                Thread.currentThread().interrupt();
            }
        } else {
            System.err.println("Warning: Could not find HeadlessApplication main loop thread.");
        }
    }
}
