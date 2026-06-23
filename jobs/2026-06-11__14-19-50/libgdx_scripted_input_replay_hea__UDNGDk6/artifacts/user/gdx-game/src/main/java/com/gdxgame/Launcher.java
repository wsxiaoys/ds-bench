package com.gdxgame;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Entry point for the headless grid walker simulation.
 *
 * Accepts --input=&lt;file&gt; to specify the keystroke replay file.
 * Boots a HeadlessApplication, overwrites the default MockInput with
 * a ScriptedInput, and blocks until the simulation completes.
 */
public class Launcher {

    public static void main(String[] args) {
        Path inputFile = null;

        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputFile = Paths.get(arg.substring("--input=".length()));
            }
        }

        if (inputFile == null) {
            System.err.println("Error: missing required argument --input=<file>");
            System.exit(1);
            return;
        }

        ScriptedInput scriptedInput;
        try {
            scriptedInput = new ScriptedInput(inputFile);
        } catch (IOException e) {
            System.err.println("Error: cannot read input file: " + inputFile);
            System.exit(1);
            return;
        } catch (IllegalArgumentException e) {
            System.err.println(e.getMessage());
            System.exit(1);
            return;
        }

        // Set Gdx.input before constructing HeadlessApplication so that
        // when the constructor overwrites it with MockInput, we can
        // overwrite it back after construction.
        Gdx.input = scriptedInput;

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60;

        WalkerGame game = new WalkerGame(scriptedInput);

        HeadlessApplication app = new HeadlessApplication(game, config);

        // Overwrite the MockInput that the constructor set with our ScriptedInput.
        Gdx.input = scriptedInput;

        // Block until the application exits.
        // The WalkerGame.render() calls Gdx.app.exit() when the script is exhausted.
        // We poll until the application thread has finished.
        while (true) {
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
            // Once the script is exhausted and the final position has been printed,
            // Gdx.app.exit() will have been called. Give a small grace period for
            // the exit to propagate and then break.
            if (scriptedInput.isExhausted()) {
                try {
                    Thread.sleep(300);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                break;
            }
        }
    }
}
