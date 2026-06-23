package com.game.headless;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.game.core.GameListener;

public class HeadlessLauncher {
    public static void main(String[] args) throws InterruptedException {
        String map = null;
        String commands = null;
        String transcript = null;

        for (String arg : args) {
            if (arg.startsWith("--map=")) {
                map = arg.substring(6);
            } else if (arg.startsWith("--commands=")) {
                commands = arg.substring(11);
            } else if (arg.startsWith("--transcript=")) {
                transcript = arg.substring(13);
            }
        }

        if (map == null || commands == null || transcript == null) {
            System.err.println("Missing arguments");
            System.exit(1);
        }

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 1000;

        GameListener listener = new GameListener(map, commands, transcript);
        new HeadlessApplication(listener, config);
        
        listener.getLatch().await();
    }
}
