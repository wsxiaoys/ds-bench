package com.example.astar;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;

import java.util.concurrent.CountDownLatch;

/**
 * libGDX ApplicationListener that performs the whole pathfinding computation
 * once, synchronously, inside {@link #create()}, then immediately requests
 * the headless application to exit. No GL / rendering calls are made.
 */
final class AStarApp implements ApplicationListener {

    private final String scenarioPath;
    private final String outputPath;
    private final CountDownLatch done = new CountDownLatch(1);
    private volatile int exitCode = 0;

    AStarApp(String scenarioPath, String outputPath) {
        this.scenarioPath = scenarioPath;
        this.outputPath = outputPath;
    }

    @Override
    public void create() {
        try {
            Scenario scenario = Scenario.read(scenarioPath);
            Solver solver = new Solver(scenario.rows, scenario.cols, scenario.weights);
            solver.solveAll(scenario.queries, outputPath);
            exitCode = 0;
        } catch (Throwable t) {
            t.printStackTrace();
            exitCode = 1;
        } finally {
            done.countDown();
            if (Gdx.app != null) {
                Gdx.app.exit();
            }
        }
    }

    @Override
    public void resize(int width, int height) {
        // no-op: headless, no rendering surface
    }

    @Override
    public void render() {
        // no-op: all work is done once in create()
    }

    @Override
    public void pause() {
        // no-op
    }

    @Override
    public void resume() {
        // no-op
    }

    @Override
    public void dispose() {
        // no-op
    }

    void awaitCompletion() throws InterruptedException {
        done.await();
    }

    int getExitCode() {
        return exitCode;
    }
}
