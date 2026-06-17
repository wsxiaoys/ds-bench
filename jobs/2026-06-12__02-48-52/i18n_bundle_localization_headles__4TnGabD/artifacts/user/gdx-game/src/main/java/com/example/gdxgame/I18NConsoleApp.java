package com.example.gdxgame;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.I18NBundle;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.Locale;
import java.util.MissingResourceException;
import java.util.concurrent.CountDownLatch;

/**
 * ApplicationAdapter that reads a command file and executes I18N console commands.
 *
 * Supported commands:
 *   LOCALE &lt;code&gt; - switch active bundle to the given locale
 *   GET &lt;key&gt; - print key=value using active bundle
 *   FORMAT &lt;key&gt; &lt;arg1&gt; [&lt;arg2&gt; ...] - print key=formatted using active bundle
 */
public class I18NConsoleApp extends ApplicationAdapter {

    private static final String BUNDLE_PATH = "i18n/Messages";

    private final String inputPath;
    private final CountDownLatch doneLatch = new CountDownLatch(1);

    private volatile int exitCode = 0;

    public I18NConsoleApp(String inputPath) {
        this.inputPath = inputPath;
    }

    @Override
    public void create() {
        try {
            processCommandFile();
        } finally {
            doneLatch.countDown();
        }
    }

    private void processCommandFile() {
        I18NBundle activeBundle = null;
        boolean errorEmitted = false;

        try (BufferedReader reader = new BufferedReader(new FileReader(inputPath))) {
            String line;
            while ((line = reader.readLine()) != null) {
                // Strip leading/trailing whitespace
                line = line.trim();

                // Skip blank lines and comments
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                // Already encountered a fatal error - stop processing further commands
                if (errorEmitted) {
                    break;
                }

                // Split into tokens on one or more spaces
                String[] tokens = line.split(" +");
                String command = tokens[0];

                switch (command) {
                    case "LOCALE": {
                        if (tokens.length < 2) {
                            emitError("Error: unknown command " + command);
                            errorEmitted = true;
                            break;
                        }
                        String code = tokens[1];
                        I18NBundle bundle = loadBundle(code);
                        if (bundle == null) {
                            emitError("Error: unsupported locale " + code);
                            errorEmitted = true;
                        } else {
                            activeBundle = bundle;
                        }
                        break;
                    }

                    case "GET": {
                        if (activeBundle == null) {
                            emitError("Error: no locale selected");
                            errorEmitted = true;
                            break;
                        }
                        if (tokens.length < 2) {
                            emitError("Error: unknown command " + command);
                            errorEmitted = true;
                            break;
                        }
                        String key = tokens[1];
                        String value = safeGet(activeBundle, key);
                        if (value == null) {
                            emitError("Error: missing key " + key);
                            errorEmitted = true;
                        } else {
                            System.out.println(key + "=" + value);
                        }
                        break;
                    }

                    case "FORMAT": {
                        if (activeBundle == null) {
                            emitError("Error: no locale selected");
                            errorEmitted = true;
                            break;
                        }
                        if (tokens.length < 2) {
                            emitError("Error: unknown command " + command);
                            errorEmitted = true;
                            break;
                        }
                        String key = tokens[1];
                        // All remaining tokens are arguments
                        Object[] formatArgs = new Object[tokens.length - 2];
                        for (int i = 0; i < formatArgs.length; i++) {
                            formatArgs[i] = tokens[i + 2];
                        }
                        String value = safeFormat(activeBundle, key, formatArgs);
                        if (value == null) {
                            emitError("Error: missing key " + key);
                            errorEmitted = true;
                        } else {
                            System.out.println(key + "=" + value);
                        }
                        break;
                    }

                    default: {
                        emitError("Error: unknown command " + command);
                        errorEmitted = true;
                        break;
                    }
                }
            }
        } catch (IOException e) {
            emitError("Error: could not read input file: " + e.getMessage());
            errorEmitted = true;
        }

        if (errorEmitted) {
            exitCode = 1;
        }
    }

    /**
     * Loads an I18NBundle for the given locale code.
     *
     * @param code one of {@code en}, {@code fr}, {@code de}
     * @return the bundle, or {@code null} if the code is unsupported
     */
    private I18NBundle loadBundle(String code) {
        FileHandle baseHandle = Gdx.files.internal(BUNDLE_PATH);
        switch (code) {
            case "en":
                return I18NBundle.createBundle(baseHandle, new Locale("en"));
            case "fr":
                return I18NBundle.createBundle(baseHandle, new Locale("fr"));
            case "de":
                return I18NBundle.createBundle(baseHandle, new Locale("de"));
            default:
                return null;
        }
    }

    /**
     * Calls {@link I18NBundle#get(String)} and returns {@code null} on a missing-key exception.
     */
    private String safeGet(I18NBundle bundle, String key) {
        try {
            return bundle.get(key);
        } catch (MissingResourceException e) {
            return null;
        }
    }

    /**
     * Calls {@link I18NBundle#format(String, Object...)} and returns {@code null} on a
     * missing-key exception.
     */
    private String safeFormat(I18NBundle bundle, String key, Object[] args) {
        try {
            return bundle.format(key, args);
        } catch (MissingResourceException e) {
            return null;
        }
    }

    private void emitError(String message) {
        System.err.println(message);
    }

    /**
     * Blocks until {@link #create()} has finished processing the command file.
     */
    public void awaitCompletion() throws InterruptedException {
        doneLatch.await();
    }

    public int getExitCode() {
        return exitCode;
    }
}
