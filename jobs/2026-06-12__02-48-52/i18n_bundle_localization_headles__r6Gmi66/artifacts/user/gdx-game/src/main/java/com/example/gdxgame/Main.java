package com.example.gdxgame;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.utils.I18NBundle;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.MissingResourceException;

public class Main {
    public static void main(String[] args) {
        String inputFile = null;
        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputFile = arg.substring("--input=".length());
            }
        }

        if (inputFile == null) {
            System.err.println("No input file specified.");
            System.exit(1);
        }

        final String finalInputFile = inputFile;

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        new HeadlessApplication(new ApplicationAdapter() {
            @Override
            public void create() {
                try {
                    processCommands(finalInputFile);
                    Gdx.app.exit();
                } catch (Exception e) {
                    // In case of unexpected errors
                    e.printStackTrace();
                    System.exit(1);
                }
            }
        }, config);
    }

    private static void processCommands(String inputFile) throws Exception {
        File file = new File(inputFile);
        if (!file.exists()) {
            System.err.println("Input file does not exist.");
            System.exit(1);
        }

        I18NBundle currentBundle = null;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                String[] parts = line.split("\\s+");
                String command = parts[0];

                if (command.equals("LOCALE")) {
                    if (parts.length < 2) {
                        System.err.println("Error: unsupported locale ");
                        System.exit(1);
                    }
                    String code = parts[1];
                    if (!code.equals("en") && !code.equals("fr") && !code.equals("de")) {
                        System.err.println("Error: unsupported locale " + code);
                        System.exit(1);
                    }
                    Locale locale = new Locale(code);
                    currentBundle = I18NBundle.createBundle(Gdx.files.internal("i18n/Messages"), locale);
                } else if (command.equals("GET")) {
                    if (currentBundle == null) {
                        System.err.println("Error: no locale selected");
                        System.exit(1);
                    }
                    if (parts.length < 2) {
                        System.err.println("Error: missing key ");
                        System.exit(1);
                    }
                    String key = parts[1];
                    try {
                        String value = currentBundle.get(key);
                        System.out.println(key + "=" + value);
                    } catch (MissingResourceException e) {
                        System.err.println("Error: missing key " + key);
                        System.exit(1);
                    }
                } else if (command.equals("FORMAT")) {
                    if (currentBundle == null) {
                        System.err.println("Error: no locale selected");
                        System.exit(1);
                    }
                    if (parts.length < 2) {
                        System.err.println("Error: missing key ");
                        System.exit(1);
                    }
                    String key = parts[1];
                    Object[] args = new Object[parts.length - 2];
                    for (int i = 2; i < parts.length; i++) {
                        args[i - 2] = parts[i];
                    }
                    try {
                        String value = currentBundle.format(key, args);
                        System.out.println(key + "=" + value);
                    } catch (MissingResourceException e) {
                        System.err.println("Error: missing key " + key);
                        System.exit(1);
                    }
                } else {
                    System.err.println("Error: unknown command " + command);
                    System.exit(1);
                }
            }
        }
    }
}
