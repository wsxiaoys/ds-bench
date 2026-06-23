package com.example.gdxgame;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.nio.file.Path;
import java.util.concurrent.CountDownLatch;

public final class HeadlessWalkerLauncher {
    private HeadlessWalkerLauncher() {
    }

    public static void main(String[] args) throws InterruptedException {
        Path inputFile = parseInputArgument(args);
        ScriptedMockInput scriptedInput;
        try {
            scriptedInput = new ScriptedMockInput(inputFile);
        } catch (ScriptedMockInput.UnknownKeyException e) {
            System.err.println("Error: unknown key " + e.token());
            System.exit(1);
            return;
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            System.exit(1);
            return;
        }

        CountDownLatch finishedLatch = new CountDownLatch(1);
        WalkerApplication listener = new WalkerApplication(scriptedInput, finishedLatch);

        HeadlessApplicationConfiguration configuration = new HeadlessApplicationConfiguration();
        configuration.updatesPerSecond = 60;

        new HeadlessApplication(listener, configuration);

        Gdx.input = scriptedInput;
        Gdx.input.setInputProcessor(listener.walkerProcessor());

        finishedLatch.await();
    }

    private static Path parseInputArgument(String[] args) {
        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                String value = arg.substring("--input=".length());
                if (!value.isBlank()) {
                    return Path.of(value);
                }
            }
        }

        System.err.println("Error: missing --input=<file>");
        System.exit(1);
        return Path.of("");
    }
}
