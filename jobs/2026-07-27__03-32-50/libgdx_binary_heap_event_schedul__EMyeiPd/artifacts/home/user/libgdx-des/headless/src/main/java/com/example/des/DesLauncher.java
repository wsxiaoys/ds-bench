package com.example.des;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Entry point. Boots libGDX's headless backend (no OpenGL, no window) and runs
 * the discrete-event factory simulation described by the given scenario file,
 * writing the deterministic result to the given output file.
 *
 * Usage:
 *   --input=&lt;path&gt; --output=&lt;path&gt;   (order of the two arguments does not matter)
 */
public class DesLauncher {

    public static void main(String[] args) {
        String inputArg = null;
        String outputArg = null;

        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputArg = arg.substring("--input=".length());
            } else if (arg.startsWith("--output=")) {
                outputArg = arg.substring("--output=".length());
            }
        }

        if (inputArg == null || outputArg == null) {
            System.err.println("Usage: --input=<path> --output=<path>");
            System.exit(2);
            return;
        }

        Path inputPath = Paths.get(inputArg);
        Path outputPath = Paths.get(outputArg);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Negative: never invoke render(); we do all work once in create().
        config.updatesPerSecond = -1;

        new HeadlessApplication(new SimulationListener(inputPath, outputPath), config);
    }
}
