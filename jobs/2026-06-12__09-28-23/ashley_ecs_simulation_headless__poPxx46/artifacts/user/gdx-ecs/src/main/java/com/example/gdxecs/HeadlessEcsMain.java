package com.example.gdxecs;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.lang.reflect.Field;

public final class HeadlessEcsMain {
    private HeadlessEcsMain() {
    }

    public static void main(String[] args) throws InterruptedException {
        if (args.length != 1) {
            System.err.println("Usage: gdx-ecs <scenario_path>");
            System.exit(2);
        }

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60;

        SimulationApplication listener = new SimulationApplication(args[0], System.out);
        HeadlessApplication application = new HeadlessApplication(listener, config);

        Thread mainLoopThread = getMainLoopThread(application);
        mainLoopThread.join();

        if (listener.getFailure() != null) {
            System.exit(1);
        }
    }

    private static Thread getMainLoopThread(HeadlessApplication application) {
        try {
            Field field = HeadlessApplication.class.getDeclaredField("mainLoopThread");
            field.setAccessible(true);
            Object value = field.get(application);
            if (value instanceof Thread) {
                return (Thread) value;
            }
        } catch (ReflectiveOperationException ignored) {
            // Fall back to the documented headless thread name below.
        }

        for (Thread thread : Thread.getAllStackTraces().keySet()) {
            if ("HeadlessApplication".equals(thread.getName())) {
                return thread;
            }
        }

        throw new IllegalStateException("Unable to locate libGDX HeadlessApplication main loop thread");
    }
}
