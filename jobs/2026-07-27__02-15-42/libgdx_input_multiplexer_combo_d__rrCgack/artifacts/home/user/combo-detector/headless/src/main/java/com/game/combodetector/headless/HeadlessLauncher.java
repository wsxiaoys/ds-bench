package com.game.combodetector.headless;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import java.util.concurrent.CountDownLatch;

public class HeadlessLauncher {
    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: HeadlessLauncher <input_file> <output_file>");
            System.exit(1);
        }
        String inputFile = args[0];
        String outputFile = args[1];

        CountDownLatch latch = new CountDownLatch(1);
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0; // run as fast as possible, never sleep

        ComboDetectorGame game = new ComboDetectorGame(inputFile, outputFile, latch);
        new HeadlessApplication(game, config);

        try {
            latch.await();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}
