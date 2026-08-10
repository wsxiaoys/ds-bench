package com.example.affine;

import com.badlogic.gdx.ApplicationAdapter;

import java.nio.file.Path;

/**
 * Runs the affine pipeline interpreter once during {@link #create()} and
 * then terminates the process. No graphics/OpenGL calls are performed,
 * making this safe to run under the libGDX headless backend.
 */
public final class AffineApplicationListener extends ApplicationAdapter {

    private final Path inputPath;
    private final Path outputPath;

    public AffineApplicationListener(Path inputPath, Path outputPath) {
        this.inputPath = inputPath;
        this.outputPath = outputPath;
    }

    @Override
    public void create() {
        int exitCode = 0;
        try {
            new PipelineInterpreter().run(inputPath, outputPath);
        } catch (Exception e) {
            e.printStackTrace();
            exitCode = 1;
        }
        // Terminate the process ourselves once the work is done, rather than
        // relying on the headless render loop.
        System.exit(exitCode);
    }
}
