package com.des;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;

import java.nio.file.Path;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Drives the {@link Simulation} from the headless application's render/tick
 * loop: exactly one event is processed per {@link #render()} call. Once the
 * event heap is drained, the report is written and the application exits.
 */
public final class SimulationListener implements ApplicationListener {

    private final Path scenarioPath;
    private final Path outPath;
    private final CountDownLatch doneLatch;
    private final AtomicReference<Throwable> failure;

    private Simulation simulation;

    public SimulationListener(Path scenarioPath, Path outPath, CountDownLatch doneLatch, AtomicReference<Throwable> failure) {
        this.scenarioPath = scenarioPath;
        this.outPath = outPath;
        this.doneLatch = doneLatch;
        this.failure = failure;
    }

    @Override
    public void create() {
        try {
            Scenario scenario = ScenarioParser.parse(scenarioPath);
            simulation = new Simulation(scenario);
        } catch (Throwable t) {
            failure.set(t);
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        if (simulation == null) {
            // create() already failed; nothing to do but wait for exit to take effect.
            return;
        }
        try {
            if (simulation.isFinished()) {
                return;
            }
            boolean progressed = simulation.step();
            if (!progressed || simulation.isFinished()) {
                ReportWriter.write(simulation, outPath);
                Gdx.app.exit();
            }
        } catch (Throwable t) {
            failure.set(t);
            Gdx.app.exit();
        }
    }

    @Override
    public void resize(int width, int height) {
        // no-op: headless, no rendering surface
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
        doneLatch.countDown();
    }
}
