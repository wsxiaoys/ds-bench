package com.example.gdxgame;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Entry point for the libGDX headless I18N console.
 *
 * <p>Usage: gdx-game --input=&lt;path-to-command-file&gt;
 */
public class Launcher {

    public static void main(String[] args) throws InterruptedException {
        String inputPath = null;
        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputPath = arg.substring("--input=".length());
            }
        }

        if (inputPath == null) {
            System.err.println("Error: --input=<file> argument is required");
            System.exit(1);
        }

        I18NConsoleApp app = new I18NConsoleApp(inputPath);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Disable the render loop so the app processes exactly one "frame" via create()
        config.updatesPerSecond = -1;

        HeadlessApplication headlessApp = new HeadlessApplication(app, config);

        // Wait for the application listener to finish processing
        app.awaitCompletion();

        headlessApp.exit();

        // Propagate exit code
        int exitCode = app.getExitCode();
        if (exitCode != 0) {
            System.exit(exitCode);
        }
    }
}
