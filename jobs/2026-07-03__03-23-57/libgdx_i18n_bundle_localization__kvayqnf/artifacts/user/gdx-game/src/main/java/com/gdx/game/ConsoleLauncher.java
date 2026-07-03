package com.gdx.game;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.io.File;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;

public class ConsoleLauncher {
    public static void main(String[] args) {
        Locale.setDefault(Locale.ROOT);

        String inputFilePath = null;
        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputFilePath = arg.substring("--input=".length());
            }
        }

        if (inputFilePath == null) {
            System.err.println("Error: Missing --input=<file> argument");
            System.exit(1);
        }

        File inputFile = new File(inputFilePath);
        if (!inputFile.exists() || !inputFile.isFile()) {
            System.err.println("Error: Input file does not exist or is not a file: " + inputFilePath);
            System.exit(1);
        }

        CountDownLatch latch = new CountDownLatch(1);
        I18NConsoleApp app = new I18NConsoleApp(inputFile, latch);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60;

        new HeadlessApplication(app, config);

        try {
            latch.await();
        } catch (InterruptedException e) {
            System.err.println("Error: Application interrupted");
            System.exit(1);
        }

        System.exit(app.getExitCode());
    }
}
