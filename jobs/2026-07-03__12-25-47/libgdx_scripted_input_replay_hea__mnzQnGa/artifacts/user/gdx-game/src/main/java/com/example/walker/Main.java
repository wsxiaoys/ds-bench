package com.example.walker;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

public class Main {
    public static void main(String[] args) throws Exception {
        String inputPath = null;
        for (String arg : args) {
            if (arg != null && arg.startsWith("--input=")) {
                inputPath = arg.substring("--input=".length());
            }
        }
        if (inputPath == null) {
            System.err.println("Usage: gdx-game --input=<path>");
            System.exit(2);
            return;
        }

        final ScriptedInput scriptedInput;
        try {
            scriptedInput = new ScriptedInput(inputPath);
        } catch (IllegalArgumentException e) {
            System.err.println("Error: " + e.getMessage());
            System.exit(1);
            return;
        }

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60;

        final WalkerGame game = new WalkerGame();
        game.setScriptedInput(scriptedInput);

        HeadlessApplication app = new HeadlessApplication(game, config);
        // Replace the framework's MockInput with our scripted subclass
        Gdx.input = scriptedInput;
        // Re-register the InputProcessor now that Gdx.input refers to our scripted instance
        Gdx.input.setInputProcessor(game);

        // Wait for WalkerGame.create() to have captured the main loop thread
        Thread loopThread = null;
        long deadline = System.currentTimeMillis() + 10000L;
        while ((loopThread = game.getMainLoopThread()) == null && System.currentTimeMillis() < deadline) {
            Thread.sleep(5);
        }
        // mainLoopThread is protected; access via reflection as a robust alternative
        if (loopThread == null) {
            try {
                java.lang.reflect.Field f = HeadlessApplication.class.getDeclaredField("mainLoopThread");
                f.setAccessible(true);
                loopThread = (Thread) f.get(app);
            } catch (Throwable t) {
                // ignore
            }
        }
        if (loopThread != null) {
            try {
                loopThread.join();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        System.out.println("Final position: (" + game.getX() + ", " + game.getY() + ")");
        System.exit(0);
    }
}
