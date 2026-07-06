package com.example.sim;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.lang.reflect.Field;

public class Main {
    public static void main(String[] args) throws Exception {
        String scenario = null;
        String output = null;

        // Accept --scenario <path> --output <path> in any order.
        for (int i = 0; i < args.length; i++) {
            String a = args[i];
            if ("--scenario".equals(a) || "-s".equals(a)) {
                scenario = args[++i];
            } else if ("--output".equals(a) || "-o".equals(a)) {
                output = args[++i];
            }
        }
        if (scenario == null || output == null) {
            System.err.println("Usage: --scenario <scenario_path> --output <output_path>");
            System.exit(1);
        }

        HeadlessApplicationConfiguration cfg = new HeadlessApplicationConfiguration();
        cfg.updatesPerSecond = 0; // run as fast as possible

        SimulationListener listener = new SimulationListener(scenario, output);
        HeadlessApplication app = new HeadlessApplication(listener, cfg);

        // HeadlessApplication keeps its rendering thread in a protected
        // field "mainLoopThread". Reflectively grab it so we can join.
        try {
            Field f = HeadlessApplication.class.getDeclaredField("mainLoopThread");
            f.setAccessible(true);
            Thread t = (Thread) f.get(app);
            if (t != null) {
                t.join();
            }
        } catch (NoSuchFieldException | IllegalAccessException ex) {
            // Fall back: poll until the listener has finished writing.
            for (int i = 0; i < 6000; i++) {
                Thread.sleep(10);
            }
        }
    }
}
