package com.combodetector.core;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.InputMultiplexer;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * Wires together the {@link TimelineParser}, {@link TimelineMockInput}, {@link PauseProcessor} and
 * {@link ComboProcessor} to replay an input timeline file and collect the recognized combos.
 */
public final class ComboDetectorRunner {

    /** Result of a full timeline replay: chronological combo log plus final tally. */
    public static final class Result {
        public final List<ComboProcessor.Recognition> log;
        public final Map<String, Integer> tally;

        Result(List<ComboProcessor.Recognition> log, Map<String, Integer> tally) {
            this.log = log;
            this.tally = tally;
        }
    }

    private ComboDetectorRunner() {
    }

    public static Result run(Path inputFile) throws IOException {
        List<List<TimelineMockInput.Event>> ticks = TimelineParser.parse(inputFile);

        PauseProcessor pauseProcessor = new PauseProcessor();
        ComboProcessor comboProcessor = new ComboProcessor();
        InputMultiplexer multiplexer = new InputMultiplexer(pauseProcessor, comboProcessor);

        TimelineMockInput input = new TimelineMockInput(ticks);
        input.setInputProcessor(multiplexer);

        // Make this the application's actual input source, as a real libGDX game would use Gdx.input.
        Gdx.input = input;

        input.replay(comboProcessor::setCurrentTick);

        return new Result(comboProcessor.getLog(), comboProcessor.getTally());
    }
}
