package com.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.io.IOException;
import java.nio.file.Paths;
import java.util.concurrent.CountDownLatch;

/**
 * Launcher for the headless libGDX grid walker simulation.
 * Accepts a --input=&lt;file&gt; argument pointing to a keystroke replay file.
 */
public class Main {

    public static void main(String[] args) {
        String inputFile = null;

        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputFile = arg.substring("--input=".length());
            }
        }

        if (inputFile == null) {
            System.err.println("Usage: gdx-game --input=<file>");
            System.exit(1);
            return;
        }

        // Validate and parse the keystroke file
        ScriptedInput scriptedInput;
        try {
            scriptedInput = new ScriptedInput(Paths.get(inputFile));
        } catch (ScriptedInput.UnknownKeyException e) {
            System.err.println("Error: unknown key " + e.getToken());
            System.exit(1);
            return;
        } catch (IOException e) {
            System.err.println("Error reading file: " + inputFile);
            System.exit(1);
            return;
        }

        // Latch to block main thread until simulation completes
        CountDownLatch latch = new CountDownLatch(1);

        WalkerListener listener = new WalkerListener(scriptedInput, latch);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60;

        HeadlessApplication app = new HeadlessApplication(listener, config);

        // Replace the default MockInput with our scripted input
        Gdx.input = scriptedInput;

        // Block the main thread until the simulation finishes
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}