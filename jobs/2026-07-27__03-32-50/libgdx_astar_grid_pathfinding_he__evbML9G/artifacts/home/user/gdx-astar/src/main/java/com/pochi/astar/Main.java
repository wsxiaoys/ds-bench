package com.pochi.astar;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Entry point. Boots a libGDX headless application (no graphics / audio / GL)
 * that reads a weighted grid map and prints the minimum cost path between the
 * configured start and goal cells.
 */
public final class Main {

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: gdx-astar <map-file-path>");
            System.exit(1);
            return;
        }

        String mapFilePath = args[0];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // We do all of our work once in create() and then exit; no periodic
        // update/render loop is needed for this command line tool.
        config.updatesPerSecond = -1;

        new HeadlessApplication(new PathfinderApplication(mapFilePath), config);
    }

    private Main() {
    }
}
