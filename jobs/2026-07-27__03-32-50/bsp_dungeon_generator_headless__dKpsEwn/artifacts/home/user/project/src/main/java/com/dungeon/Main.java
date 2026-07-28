package com.dungeon;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * Entry point. Runs the whole dungeon generation pipeline inside a
 * libGDX HeadlessApplication, as required.
 */
public class Main {

    public static void main(String[] args) {
        if (args.length != 2) {
            System.err.println("Usage: run.sh <input_file> <output_dir>");
            System.exit(2);
            return;
        }

        final String inputFile = args[0];
        final String outputDir = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // We only need create() to run once; no render loop required.
        config.updatesPerSecond = -1;

        ApplicationListener listener = new ApplicationListener() {
            @Override
            public void create() {
                try {
                    DungeonGenerator.run(inputFile, outputDir);
                    // Successful completion: shut the headless app down cleanly.
                    Gdx.app.exit();
                } catch (Throwable t) {
                    StringWriter sw = new StringWriter();
                    t.printStackTrace(new PrintWriter(sw));
                    System.err.println(sw);
                    // Force JVM exit with a failure code, even from this worker thread.
                    System.exit(1);
                }
            }

            @Override
            public void resize(int width, int height) {
            }

            @Override
            public void render() {
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
        };

        new HeadlessApplication(listener, config);
    }
}
