package com.sim;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

public class Main {
    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: Main <config-path> <output-path>");
            System.exit(1);
        }

        String configPath = args[0];
        String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        SimulationListener listener = new SimulationListener(configPath, outputPath);
        
        MyHeadlessApplication app = new MyHeadlessApplication(listener, config);

        try {
            Thread thread = app.getMainLoopThread();
            if (thread != null) {
                thread.join();
            }
        } catch (InterruptedException e) {
            e.printStackTrace();
        }

        System.exit(0);
    }

    private static class MyHeadlessApplication extends HeadlessApplication {
        public MyHeadlessApplication(SimulationListener listener, HeadlessApplicationConfiguration config) {
            super(listener, config);
        }

        public Thread getMainLoopThread() {
            return this.mainLoopThread;
        }
    }
}
