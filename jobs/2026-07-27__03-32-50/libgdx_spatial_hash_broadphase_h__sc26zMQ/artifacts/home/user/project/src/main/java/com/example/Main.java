package com.example;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Entry point. Runs the spatial-hash broad-phase collision simulation under
 * the libGDX headless backend (no OpenGL / Gdx.gl* calls are made).
 *
 * Usage: <input_file> <output_file>
 */
public class Main {
    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: <input_file> <output_file>");
            System.exit(1);
            return;
        }

        final String inputPath = args[0];
        final String outputPath = args[1];
        final int[] exitCode = {0};

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        new HeadlessApplication(new ApplicationAdapter() {
            @Override
            public void create() {
                try {
                    Simulation.run(inputPath, outputPath);
                } catch (Exception e) {
                    e.printStackTrace();
                    exitCode[0] = 1;
                } finally {
                    Gdx.app.exit();
                }
            }
        }, config);

        if (exitCode[0] != 0) {
            System.exit(exitCode[0]);
        }
    }
}
