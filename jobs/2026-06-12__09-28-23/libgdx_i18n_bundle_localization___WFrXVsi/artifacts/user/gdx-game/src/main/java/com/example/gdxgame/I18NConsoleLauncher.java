package com.example.gdxgame;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.I18NBundle;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.MissingResourceException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

public final class I18NConsoleLauncher {
    private I18NConsoleLauncher() {
    }

    public static void main(String[] args) throws InterruptedException {
        CountDownLatch done = new CountDownLatch(1);
        AtomicInteger exitCode = new AtomicInteger(0);
        String inputPath = parseInputPath(args, exitCode);

        if (inputPath == null) {
            System.err.println("Error: missing --input=<file> argument");
            System.exit(exitCode.get());
            return;
        }

        HeadlessApplicationConfiguration configuration = new HeadlessApplicationConfiguration();
        new HeadlessApplication(new LocalizationConsole(inputPath, done, exitCode), configuration);

        done.await();
        System.out.flush();
        System.err.flush();
        System.exit(exitCode.get());
    }

    private static String parseInputPath(String[] args, AtomicInteger exitCode) {
        if (args.length != 1 || !args[0].startsWith("--input=")) {
            exitCode.set(1);
            return null;
        }

        String inputPath = args[0].substring("--input=".length());
        if (inputPath.isEmpty()) {
            exitCode.set(1);
            return null;
        }

        return inputPath;
    }

    private static final class LocalizationConsole extends ApplicationAdapter {
        private final String inputPath;
        private final CountDownLatch done;
        private final AtomicInteger exitCode;
        private final Map<String, I18NBundle> bundles = new HashMap<>();
        private I18NBundle activeBundle;

        private LocalizationConsole(String inputPath, CountDownLatch done, AtomicInteger exitCode) {
            this.inputPath = inputPath;
            this.done = done;
            this.exitCode = exitCode;
        }

        @Override
        public void create() {
            try {
                processCommands();
                exitCode.set(0);
            } catch (CommandException error) {
                exitCode.set(1);
                System.err.println(error.getMessage());
            } catch (IOException error) {
                exitCode.set(1);
                System.err.println("Error: " + error.getMessage());
            } finally {
                System.out.flush();
                System.err.flush();
                done.countDown();
                Gdx.app.exit();
            }
        }

        private void processCommands() throws IOException, CommandException {
            List<String> lines = Files.readAllLines(Path.of(inputPath), StandardCharsets.UTF_8);

            for (String sourceLine : lines) {
                String line = sourceLine.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                String[] tokens = line.split("\\s+");
                String command = tokens[0];
                switch (command) {
                    case "LOCALE" -> selectLocale(tokens);
                    case "GET" -> getValue(tokens);
                    case "FORMAT" -> formatValue(tokens);
                    default -> throw new CommandException("Error: unknown command " + command);
                }
            }
        }

        private void selectLocale(String[] tokens) throws CommandException {
            String code = tokens.length > 1 ? tokens[1] : "";
            if (!code.equals("en") && !code.equals("fr") && !code.equals("de")) {
                throw new CommandException("Error: unsupported locale " + code);
            }

            activeBundle = bundles.computeIfAbsent(code, this::loadBundle);
        }

        private I18NBundle loadBundle(String code) {
            FileHandle baseFile = Gdx.files.internal("i18n/Messages");
            return I18NBundle.createBundle(baseFile, new Locale(code));
        }

        private void getValue(String[] tokens) throws CommandException {
            ensureLocaleSelected();
            String key = tokens.length > 1 ? tokens[1] : "";

            try {
                System.out.println(key + "=" + activeBundle.get(key));
            } catch (MissingResourceException error) {
                throw new CommandException("Error: missing key " + key);
            }
        }

        private void formatValue(String[] tokens) throws CommandException {
            ensureLocaleSelected();
            String key = tokens.length > 1 ? tokens[1] : "";
            String[] arguments = new String[Math.max(0, tokens.length - 2)];
            if (tokens.length > 2) {
                System.arraycopy(tokens, 2, arguments, 0, arguments.length);
            }

            try {
                System.out.println(key + "=" + activeBundle.format(key, (Object[]) arguments));
            } catch (MissingResourceException error) {
                throw new CommandException("Error: missing key " + key);
            }
        }

        private void ensureLocaleSelected() throws CommandException {
            if (activeBundle == null) {
                throw new CommandException("Error: no locale selected");
            }
        }
    }

    private static final class CommandException extends Exception {
        private CommandException(String message) {
            super(message);
        }
    }
}
