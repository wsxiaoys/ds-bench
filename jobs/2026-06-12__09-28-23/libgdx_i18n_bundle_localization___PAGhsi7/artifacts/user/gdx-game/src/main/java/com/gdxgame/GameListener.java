package com.gdxgame;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.I18NBundle;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class GameListener extends ApplicationAdapter {

    private final String inputPath;
    private boolean done;

    public GameListener(String inputPath) {
        this.inputPath = inputPath;
    }

    @Override
    public void create() {
        try {
            processCommands();
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            System.exit(1);
        } finally {
            done = true;
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        // Nothing to render; headless mode.
    }

    private void processCommands() throws IOException {
        Path path = Paths.get(inputPath);
        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);

        I18NBundle activeBundle = null;
        String activeCode = null;
        boolean errored = false;

        // Pre-load bundles for known locales
        FileHandle baseHandle = Gdx.files.internal("i18n/Messages");
        I18NBundle baseBundle = I18NBundle.createBundle(baseHandle);

        for (int lineNum = 0; lineNum < lines.size(); lineNum++) {
            String rawLine = lines.get(lineNum);
            String line = rawLine.trim();

            // Skip blank lines and comments
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }

            // Split into tokens by whitespace
            String[] tokens = line.split("\\s+");
            String command = tokens[0];

            switch (command) {
                case "LOCALE": {
                    if (tokens.length < 2) {
                        System.err.println("Error: unsupported locale ");
                        errored = true;
                        break;
                    }
                    String code = tokens[1];
                    switch (code) {
                        case "en":
                            activeBundle = baseBundle;
                            activeCode = "en";
                            break;
                        case "fr":
                            activeBundle = I18NBundle.createBundle(baseHandle, new Locale("fr"));
                            activeCode = "fr";
                            break;
                        case "de":
                            activeBundle = I18NBundle.createBundle(baseHandle, new Locale("de"));
                            activeCode = "de";
                            break;
                        default:
                            System.err.println("Error: unsupported locale " + code);
                            errored = true;
                            break;
                    }
                    break;
                }
                case "GET": {
                    if (activeBundle == null) {
                        System.err.println("Error: no locale selected");
                        errored = true;
                        break;
                    }
                    if (tokens.length < 2) {
                        System.err.println("Error: missing key ");
                        errored = true;
                        break;
                    }
                    String key = tokens[1];
                    // Check if key exists in active bundle or its fallback chain
                    // I18NBundle.get() throws MissingResourceException if key is missing
                    try {
                        String value = activeBundle.get(key);
                        System.out.println(key + "=" + value);
                    } catch (java.util.MissingResourceException e) {
                        System.err.println("Error: missing key " + key);
                        errored = true;
                    }
                    break;
                }
                case "FORMAT": {
                    if (activeBundle == null) {
                        System.err.println("Error: no locale selected");
                        errored = true;
                        break;
                    }
                    if (tokens.length < 2) {
                        System.err.println("Error: missing key ");
                        errored = true;
                        break;
                    }
                    String key = tokens[1];
                    // Collect arguments
                    Object[] args = new Object[tokens.length - 2];
                    for (int i = 2; i < tokens.length; i++) {
                        args[i - 2] = tokens[i];
                    }
                    try {
                        String value = activeBundle.format(key, args);
                        System.out.println(key + "=" + value);
                    } catch (java.util.MissingResourceException e) {
                        System.err.println("Error: missing key " + key);
                        errored = true;
                    }
                    break;
                }
                default:
                    System.err.println("Error: unknown command " + command);
                    errored = true;
                    break;
            }

            if (errored) {
                break;
            }
        }

        if (errored) {
            System.exit(1);
        } else {
            System.exit(0);
        }
    }
}
