package com.gdx.game;

import com.badlogic.gdx.Application;
import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.utils.I18NBundle;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import java.util.Locale;
import java.util.MissingResourceException;
import java.util.concurrent.CountDownLatch;

public class I18NConsoleApp extends ApplicationAdapter {
    private final File inputFile;
    private final CountDownLatch latch;
    private int exitCode = 0;

    public I18NConsoleApp(File inputFile, CountDownLatch latch) {
        this.inputFile = inputFile;
        this.latch = latch;
    }

    @Override
    public void create() {
        Gdx.app.setLogLevel(Application.LOG_NONE);

        List<String> lines;
        try {
            lines = Files.readAllLines(inputFile.toPath(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            System.err.println("Error: Cannot read input file: " + e.getMessage());
            exitCode = 1;
            Gdx.app.exit();
            return;
        }

        I18NBundle activeBundle = null;

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }

            String[] tokens = trimmed.split("\\s+");
            if (tokens.length == 0) {
                continue;
            }

            String command = tokens[0];
            if ("LOCALE".equals(command)) {
                if (tokens.length < 2) {
                    System.err.println("Error: unsupported locale ");
                    exitCode = 1;
                    break;
                }
                String code = tokens[1];
                if (!"en".equals(code) && !"fr".equals(code) && !"de".equals(code)) {
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
            } else if ("GET".equals(command)) {
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
                    String val = activeBundle.get(key);
                    System.out.println(key + "=" + val);
                } catch (MissingResourceException e) {
                    System.err.println("Error: missing key " + key);
                    exitCode = 1;
                    break;
                }
            } else if ("FORMAT".equals(command)) {
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

                String[] argsArray = new String[tokens.length - 2];
                System.arraycopy(tokens, 2, argsArray, 0, tokens.length - 2);

                try {
                    String val = activeBundle.format(key, (Object[]) argsArray);
                    System.out.println(key + "=" + val);
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

        Gdx.app.exit();
    }

    @Override
    public void dispose() {
        latch.countDown();
    }

    public int getExitCode() {
        return exitCode;
    }
}
