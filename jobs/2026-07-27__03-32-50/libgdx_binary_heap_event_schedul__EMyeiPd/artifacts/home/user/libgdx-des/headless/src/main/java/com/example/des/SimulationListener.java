package com.example.des;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;

import java.nio.file.Path;

/**
 * libGDX {@link com.badlogic.gdx.ApplicationListener} that drives the whole
 * simulation from within {@link #create()}, then exits the headless app.
 * No OpenGL / Gdx.gl* calls are made anywhere; this listener is pure logic.
 */
public class SimulationListener extends ApplicationAdapter {

    private final Path inputPath;
    private final Path outputPath;

    public SimulationListener(Path inputPath, Path outputPath) {
        this.inputPath = inputPath;
        this.outputPath = outputPath;
    }

    @Override
    public void create() {
        int exitCode = 0;
        try {
            Simulator.run(inputPath, outputPath);
        } catch (Exception e) {
            e.printStackTrace();
            exitCode = 1;
        }

        // Headless app is configured with a negative render interval, so render()
        // is never invoked and the main loop thread will terminate right after
        // create() returns. We still call exit() defensively.
        Gdx.app.exit();

        if (exitCode != 0) {
            System.exit(exitCode);
        }
    }
}
