package com.game.combodetector.headless;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.InputMultiplexer;
import java.io.IOException;
import java.util.concurrent.CountDownLatch;

public class ComboDetectorGame implements ApplicationListener {
    private final String inputFilePath;
    private final String outputFilePath;
    private final CountDownLatch latch;

    private ReplayInput replayInput;
    private PauseProcessor pauseProcessor;
    private ComboProcessor comboProcessor;

    public ComboDetectorGame(String inputFilePath, String outputFilePath, CountDownLatch latch) {
        this.inputFilePath = inputFilePath;
        this.outputFilePath = outputFilePath;
        this.latch = latch;
    }

    @Override
    public void create() {
        try {
            replayInput = new ReplayInput(inputFilePath);
            Gdx.input = replayInput;

            pauseProcessor = new PauseProcessor();
            comboProcessor = new ComboProcessor(replayInput);

            InputMultiplexer multiplexer = new InputMultiplexer();
            multiplexer.addProcessor(pauseProcessor);
            multiplexer.addProcessor(comboProcessor);

            replayInput.setInputProcessor(multiplexer);

        } catch (Exception e) {
            e.printStackTrace();
            latch.countDown();
            Gdx.app.exit();
        }
    }

    @Override
    public void resize(int width, int height) {}

    @Override
    public void render() {
        if (replayInput != null && replayInput.hasMoreTicks()) {
            replayInput.tick();
        } else {
            writeOutputAndExit();
        }
    }

    private void writeOutputAndExit() {
        try {
            if (comboProcessor != null) {
                comboProcessor.writeResults(outputFilePath);
            }
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            latch.countDown();
            Gdx.app.exit();
        }
    }

    @Override
    public void pause() {}

    @Override
    public void resume() {}

    @Override
    public void dispose() {}
}
