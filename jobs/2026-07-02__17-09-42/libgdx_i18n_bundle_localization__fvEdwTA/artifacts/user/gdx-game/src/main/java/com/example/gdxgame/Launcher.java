package com.example.gdxgame;

import com.badlogic.gdx.backends.headless.HeadlessApplication;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Launcher entry point for the headless libGDX I18NBundle console.
 *
 * <p>Usage: {@code gdx-game --input=<command-file>}
 *
 * <p>The launcher boots a {@link HeadlessApplication} on its own thread and
 * blocks {@code main} until the {@link I18nConsole} listener has processed
 * every command in the input file. The process exit code mirrors whether
 * the listener completed successfully (0) or reported an error (1).
 */
public final class Launcher {

    private Launcher() {
    }

    public static void main(String[] args) throws Exception {
        Path inputFile = parseInputArgument(args);
        if (inputFile == null) {
            System.err.println("Error: missing --input=<file> argument");
            System.exit(2);
            return;
        }

        List<String> lines;
        try {
            lines = Files.readAllLines(inputFile, StandardCharsets.UTF_8);
        } catch (Exception e) {
            System.err.println("Error: unable to read input file " + inputFile);
            System.exit(1);
            return;
        }

        CountDownLatch done = new CountDownLatch(1);
        I18nConsole listener = new I18nConsole(lines, done);

        HeadlessApplication application;
        try {
            application = new HeadlessApplication(listener);
        } catch (Throwable t) {
            System.err.println("Error: failed to start headless application: " + t.getMessage());
            System.exit(1);
            return;
        }

        boolean finished = done.await(60L, TimeUnit.SECONDS);
        if (!finished) {
            System.err.println("Error: headless application did not finish in time");
            try {
                application.exit();
            } catch (Throwable ignored) {
                // best effort
            }
            System.exit(1);
            return;
        }

        System.exit(listener.hasErrored() ? 1 : 0);
    }

    private static Path parseInputArgument(String[] args) {
        for (String arg : args) {
            if (arg == null) {
                continue;
            }
            if (arg.startsWith("--input=")) {
                return Paths.get(arg.substring("--input=".length()));
            }
        }
        return null;
    }
}