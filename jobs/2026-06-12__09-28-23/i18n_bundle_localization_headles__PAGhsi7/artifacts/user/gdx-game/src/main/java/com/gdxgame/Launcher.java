package com.gdxgame;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.lang.reflect.Field;

public class Launcher {

    public static void main(String[] args) {
        String inputPath = null;

        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputPath = arg.substring("--input=".length());
            }
        }

        if (inputPath == null) {
            System.err.println("Error: no --input=<file> argument provided");
            System.exit(1);
        }

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = -1;

        HeadlessApplication app = new HeadlessApplication(new GameListener(inputPath), config);

        // Block until the application exits by accessing the protected mainLoopThread field
        try {
            Field mainLoopThreadField = HeadlessApplication.class.getDeclaredField("mainLoopThread");
            mainLoopThreadField.setAccessible(true);
            Thread mainLoopThread = (Thread) mainLoopThreadField.get(app);
            if (mainLoopThread != null) {
                mainLoopThread.join();
            }
        } catch (NoSuchFieldException | IllegalAccessException e) {
            // Fallback: just wait a short while
            try {
                Thread.sleep(2000);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
