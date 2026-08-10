package com.combodetector.headless;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.combodetector.core.ComboDetectorRunner;
import com.combodetector.core.OutputWriter;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Path;

/**
 * The one and only {@link ApplicationListener} for this app. All real work happens once, inside
 * {@link #create()}: parse the timeline, replay it through the multiplexer, write the report, exit.
 */
public class ComboDetectorApplication implements ApplicationListener {

    private final Path inputFile;
    private final Path outputFile;

    public ComboDetectorApplication(Path inputFile, Path outputFile) {
        this.inputFile = inputFile;
        this.outputFile = outputFile;
    }

    @Override
    public void create() {
        try {
            ComboDetectorRunner.Result result = ComboDetectorRunner.run(inputFile);
            OutputWriter.write(outputFile, result.log, result.tally);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } finally {
            Gdx.app.exit();
        }
    }

    @Override
    public void resize(int width, int height) {
        // no-op: headless, no window to resize
    }

    @Override
    public void render() {
        // no-op: not called, updatesPerSecond is negative
    }

    @Override
    public void pause() {
        // no-op
    }

    @Override
    public void resume() {
        // no-op
    }

    @Override
    public void dispose() {
        // no-op
    }
}
