package com.example.affine;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Entry point for the affine transform pipeline interpreter. Expects
 * exactly two command-line arguments: {@code --input=<path>} and
 * {@code --output=<path>}.
 */
public final class HeadlessLauncher {

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
            System.exit(1);
            return;
        }

        Path inputPath = Paths.get(inputArg);
        Path outputPath = Paths.get(outputArg);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        new HeadlessApplication(new AffineApplicationListener(inputPath, outputPath), config);
    }
}
