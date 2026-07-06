package com.example.gdxgame;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

public class Launcher {

    public static void main(String[] args) throws Exception {
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

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        I18NConsole listener = new I18NConsole(inputFile);
        HeadlessApplication app = new HeadlessApplication(listener, config);

        while (!listener.isFinished()) {
            Thread.sleep(10);
        }

        System.exit(listener.getExitCode());
    }
}
