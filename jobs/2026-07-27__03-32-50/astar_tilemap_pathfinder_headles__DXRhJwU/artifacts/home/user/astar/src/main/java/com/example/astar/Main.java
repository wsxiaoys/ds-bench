package com.example.astar;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Entry point. Boots a libGDX HeadlessApplication (no rendering, no GL) and
 * runs the weighted A* tilemap pathfinder inside it.
 *
 * Usage: Main <scenario_path> <output_path>
 */
public final class Main {

    private Main() {
    }

    public static void main(String[] args) throws InterruptedException {
        if (args.length < 2) {
            System.err.println("Usage: astar <scenario_path> <output_path>");
            System.exit(2);
            return;
        }

        String scenarioPath = args[0];
        String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // We drive completion ourselves; no periodic rendering is needed.
        config.updatesPerSecond = -1;

        AStarApp app = new AStarApp(scenarioPath, outputPath);
        new HeadlessApplication(app, config);

        app.awaitCompletion();
        System.exit(app.getExitCode());
    }
}
