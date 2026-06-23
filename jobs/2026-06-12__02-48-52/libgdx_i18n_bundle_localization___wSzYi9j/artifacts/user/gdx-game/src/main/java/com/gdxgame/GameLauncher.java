package com.gdxgame;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.utils.I18NBundle;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;

public class GameLauncher {

    public static void main(String[] args) {
        String inputFile = null;
        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputFile = arg.substring("--input=".length());
            }
        }

        if (inputFile == null) {
            System.err.println("Usage: gdx-game --input=<file>");
            System.exit(1);
        }

        List<String> lines;
        try {
            lines = Files.readAllLines(Paths.get(inputFile), StandardCharsets.UTF_8);
        } catch (Exception e) {
            System.err.println("Error: could not read input file: " + e.getMessage());
            System.exit(1);
            return;
        }

        GameListener listener = new GameListener(lines);
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        new HeadlessApplication(listener, config);

        try {
            listener.latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        System.exit(listener.exitCode);
    }
}

@SuppressWarnings("deprecation")
class GameListener extends ApplicationAdapter {

    private final List<String> lines;
    private I18NBundle bundle;
    private boolean localeSelected = false;
    final CountDownLatch latch = new CountDownLatch(1);
    int exitCode = 0;
    private boolean errorOccurred = false;

    GameListener(List<String> lines) {
        this.lines = lines;
    }

    @Override
    public void create() {
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            if (errorOccurred) break;

            // Split on one or more whitespace characters
            String[] tokens = trimmed.split("\\s+");
            String command = tokens[0];

            switch (command) {
                case "LOCALE":
                    handleLocale(tokens);
                    break;
                case "GET":
                    handleGet(tokens);
                    break;
                case "FORMAT":
                    handleFormat(tokens);
                    break;
                default:
                    error("unknown command " + command);
                    break;
            }
        }
        latch.countDown();
    }

    private void handleLocale(String[] tokens) {
        if (tokens.length < 2) {
            error("unsupported locale ");
            return;
        }
        String code = tokens[1];
        switch (code) {
            case "en":
            case "fr":
            case "de":
                bundle = I18NBundle.createBundle(
                    Gdx.files.internal("i18n/Messages"), new Locale(code));
                localeSelected = true;
                break;
            default:
                error("unsupported locale " + code);
                break;
        }
    }

    private void handleGet(String[] tokens) {
        if (!localeSelected) {
            error("no locale selected");
            return;
        }
        String key = tokens[1];
        String value = bundle.get(key);
        if (value == null) {
            error("missing key " + key);
            return;
        }
        System.out.println(key + "=" + value);
    }

    private void handleFormat(String[] tokens) {
        if (!localeSelected) {
            error("no locale selected");
            return;
        }
        String key = tokens[1];
        // Check key exists first
        if (bundle.get(key) == null) {
            error("missing key " + key);
            return;
        }
        Object[] args = new String[tokens.length - 2];
        for (int i = 2; i < tokens.length; i++) {
            args[i - 2] = tokens[i];
        }
        System.out.println(key + "=" + bundle.format(key, args));
    }

    private void error(String message) {
        System.err.println("Error: " + message);
        errorOccurred = true;
        exitCode = 1;
    }
}