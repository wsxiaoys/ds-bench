package com.mygdx.game;

import com.badlogic.gdx.Application;
import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.utils.I18NBundle;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.MissingResourceException;
import java.util.concurrent.CountDownLatch;

public class Main extends ApplicationAdapter {
    private final String inputFilePath;
    private final CountDownLatch latch;
    private int exitCode = 0;

    public Main(String inputFilePath, CountDownLatch latch) {
        this.inputFilePath = inputFilePath;
        this.latch = latch;
    }

    public int getExitCode() {
        return exitCode;
    }

    @Override
    public void create() {
        Gdx.app.setLogLevel(Application.LOG_NONE);
        Locale.setDefault(Locale.ROOT);
        I18NBundle.setExceptionOnMissingKey(true);

        I18NBundle activeBundle = null;

        try (BufferedReader reader = Files.newBufferedReader(Paths.get(inputFilePath), StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }

                String[] tokens = trimmed.split("\\s+");
                if (tokens.length == 0) {
                    continue;
                }

                String command = tokens[0];
                if (command.equals("LOCALE")) {
                    String code = tokens.length >= 2 ? tokens[1] : "";
                    if (!code.equals("en") && !code.equals("fr") && !code.equals("de")) {
                        System.err.println("Error: unsupported locale " + code);
                        exitCode = 1;
                        break;
                    }

                    try {
                        activeBundle = I18NBundle.createBundle(Gdx.files.internal("i18n/Messages"), new Locale(code));
                    } catch (Exception e) {
                        System.err.println("Error: failed to load bundle for locale " + code);
                        exitCode = 1;
                        break;
                    }

                } else if (command.equals("GET")) {
                    if (activeBundle == null) {
                        System.err.println("Error: no locale selected");
                        exitCode = 1;
                        break;
                    }
                    if (tokens.length < 2) {
                        System.err.println("Error: missing key ");
                        exitCode = 1;
                        break;
                    }
                    String key = tokens[1];
                    try {
                        String value = activeBundle.get(key);
                        System.out.println(key + "=" + value);
                    } catch (MissingResourceException e) {
                        System.err.println("Error: missing key " + key);
                        exitCode = 1;
                        break;
                    }

                } else if (command.equals("FORMAT")) {
                    if (activeBundle == null) {
                        System.err.println("Error: no locale selected");
                        exitCode = 1;
                        break;
                    }
                    if (tokens.length < 2) {
                        System.err.println("Error: missing key ");
                        exitCode = 1;
                        break;
                    }
                    String key = tokens[1];
                    String[] args = new String[tokens.length - 2];
                    System.arraycopy(tokens, 2, args, 0, args.length);
                    try {
                        String value = activeBundle.format(key, (Object[]) args);
                        System.out.println(key + "=" + value);
                    } catch (MissingResourceException e) {
                        System.err.println("Error: missing key " + key);
                        exitCode = 1;
                        break;
                    }

                } else {
                    System.err.println("Error: unknown command " + command);
                    exitCode = 1;
                    break;
                }
            }
        } catch (IOException e) {
            System.err.println("Error: failed to read input file: " + e.getMessage());
            exitCode = 1;
        } finally {
            Gdx.app.exit();
            latch.countDown();
        }
    }

    public static void main(String[] args) {
        String inputFilePath = null;
        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputFilePath = arg.substring("--input=".length());
            }
        }

        if (inputFilePath == null || inputFilePath.isEmpty()) {
            System.err.println("Error: missing --input=<file> argument");
            System.exit(1);
        }

        File file = new File(inputFilePath);
        if (!file.exists() || !file.isFile()) {
            System.err.println("Error: command file does not exist: " + inputFilePath);
            System.exit(1);
        }

        CountDownLatch latch = new CountDownLatch(1);
        Main appListener = new Main(inputFilePath, latch);
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60;

        new HeadlessApplication(appListener, config);

        try {
            latch.await();
        } catch (InterruptedException e) {
            System.err.println("Error: application interrupted");
            System.exit(1);
        }

        System.exit(appListener.getExitCode());
    }
}
