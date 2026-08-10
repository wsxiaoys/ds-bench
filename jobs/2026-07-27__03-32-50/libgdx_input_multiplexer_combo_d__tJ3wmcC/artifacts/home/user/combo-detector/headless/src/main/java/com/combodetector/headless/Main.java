package com.combodetector.headless;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Entry point. Boots a real {@link HeadlessApplication} (no graphics/audio/OpenGL) whose single
 * {@code create()} call replays the recorded input timeline and writes the combo report.
 *
 * <p>Usage: {@code headless <input_file> <output_file>}
 */
public final class Main {

    private Main() {
    }

    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: headless <input_file> <output_file>");
            System.exit(1);
            return;
        }

        Path inputFile = Paths.get(args[0]);
        Path outputFile = Paths.get(args[1]);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Negative: HeadlessApplication never calls render() / enters its loop. All work happens
        // once, synchronously, inside create() below, before the (non-daemon) app thread exits.
        config.updatesPerSecond = -1;

        new HeadlessApplication(new ComboDetectorApplication(inputFile, outputFile), config);
    }
}
