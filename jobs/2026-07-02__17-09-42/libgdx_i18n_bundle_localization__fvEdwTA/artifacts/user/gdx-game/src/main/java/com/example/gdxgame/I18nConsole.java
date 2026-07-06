package com.example.gdxgame;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.utils.I18NBundle;

import java.util.List;
import java.util.Locale;
import java.util.MissingResourceException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Headless {@link ApplicationListener} that drives the I18NBundle console.
 *
 * <p>Commands are read from the input file by the {@link Launcher} and
 * handed to this listener as a list of raw lines. The listener runs each
 * command inside {@link #create()} on the headless main-loop thread,
 * which is the only place where {@code Gdx.files.internal(...)} is safe
 * to call.
 */
public final class I18nConsole implements ApplicationListener {

    private static final String BUNDLE_BASE = "i18n/Messages";

    private final List<String> lines;
    private final CountDownLatch done;
    private final AtomicBoolean errored = new AtomicBoolean(false);

    private I18NBundle activeBundle;

    public I18nConsole(List<String> lines, CountDownLatch done) {
        this.lines = lines;
        this.done = done;
    }

    public boolean hasErrored() {
        return errored.get();
    }

    @Override
    public void create() {
        try {
            for (String raw : lines) {
                if (errored.get()) {
                    break;
                }
                processLine(raw);
            }
        } catch (Throwable t) {
            // Defensive: any unexpected error should be reported and stop processing.
            System.err.println("Error: unexpected failure: " + t.getMessage());
            errored.set(true);
        } finally {
            done.countDown();
        }
    }

    private void processLine(String rawLine) {
        if (rawLine == null) {
            return;
        }
        String line = rawLine.trim();
        if (line.isEmpty() || line.startsWith("#")) {
            return;
        }

        String[] tokens = line.split("\\s+");
        String keyword = tokens[0];

        switch (keyword) {
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
                System.err.println("Error: unknown command " + keyword);
                errored.set(true);
                break;
        }
    }

    private void handleLocale(String[] tokens) {
        if (tokens.length != 2) {
            String token = tokens.length == 0 ? "LOCALE" : tokens[0];
            System.err.println("Error: unknown command " + token);
            errored.set(true);
            return;
        }
        String code = tokens[1];
        if (!isSupportedLocale(code)) {
            System.err.println("Error: unsupported locale " + code);
            errored.set(true);
            return;
        }
        try {
            activeBundle = I18NBundle.createBundle(
                    Gdx.files.internal(BUNDLE_BASE),
                    new Locale(code));
        } catch (Throwable t) {
            System.err.println("Error: failed to load locale " + code + ": " + t.getMessage());
            errored.set(true);
        }
    }

    private void handleGet(String[] tokens) {
        if (activeBundle == null) {
            System.err.println("Error: no locale selected");
            errored.set(true);
            return;
        }
        if (tokens.length != 2) {
            System.err.println("Error: unknown command GET");
            errored.set(true);
            return;
        }
        String key = tokens[1];
        try {
            String value = activeBundle.get(key);
            System.out.println(key + "=" + value);
        } catch (MissingResourceException e) {
            System.err.println("Error: missing key " + key);
            errored.set(true);
        }
    }

    private void handleFormat(String[] tokens) {
        if (activeBundle == null) {
            System.err.println("Error: no locale selected");
            errored.set(true);
            return;
        }
        if (tokens.length < 3) {
            // FORMAT requires at least the keyword, a key, and one argument.
            System.err.println("Error: unknown command FORMAT");
            errored.set(true);
            return;
        }
        String key = tokens[1];
        Object[] args = new Object[tokens.length - 2];
        for (int i = 2; i < tokens.length; i++) {
            args[i - 2] = tokens[i];
        }
        try {
            String value = activeBundle.format(key, args);
            System.out.println(key + "=" + value);
        } catch (MissingResourceException e) {
            System.err.println("Error: missing key " + key);
            errored.set(true);
        }
    }

    private static boolean isSupportedLocale(String code) {
        return "en".equals(code) || "fr".equals(code) || "de".equals(code);
    }

    // --- Unused lifecycle hooks (required by ApplicationListener) --------

    @Override
    public void render() {
    }

    @Override
    public void resize(int width, int height) {
    }

    @Override
    public void pause() {
    }

    @Override
    public void resume() {
    }

    @Override
    public void dispose() {
    }
}