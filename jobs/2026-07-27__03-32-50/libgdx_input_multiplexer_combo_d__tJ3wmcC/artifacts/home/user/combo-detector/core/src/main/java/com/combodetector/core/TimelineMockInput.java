package com.combodetector.core;

import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

import java.util.List;

/**
 * A {@link MockInput} subclass that replays a pre-recorded, per-tick keystroke timeline into
 * whatever {@link InputProcessor} is currently registered via {@link #setInputProcessor(InputProcessor)}.
 *
 * <p>The stock {@code MockInput} does nothing on its own (its {@code setInputProcessor} is a no-op
 * and it never dispatches events), so this subclass overrides both accessors to actually retain the
 * processor and drives replay explicitly via {@link #replay(TickListener)}.
 */
public class TimelineMockInput extends MockInput {

    /** One recorded event: the tick it occurs on, the libGDX keycode, and press (true) vs release (false). */
    public static final class Event {
        public final int tick;
        public final int keycode;
        public final boolean pressed;

        public Event(int tick, int keycode, boolean pressed) {
            this.tick = tick;
            this.keycode = keycode;
            this.pressed = pressed;
        }
    }

    /** Notified right before a tick's events are dispatched, so tick-aware processors can be updated. */
    public interface TickListener {
        void onTick(int tick);
    }

    private final List<List<Event>> ticks;
    private InputProcessor processor;

    public TimelineMockInput(List<List<Event>> ticks) {
        this.ticks = ticks;
    }

    @Override
    public void setInputProcessor(InputProcessor processor) {
        this.processor = processor;
    }

    @Override
    public InputProcessor getInputProcessor() {
        return processor;
    }

    /**
     * Dispatches every recorded tick, in order, into the registered input processor. For each tick,
     * {@code tickListener} (if non-null) is invoked first, then every event token on that tick is
     * dispatched strictly left-to-right as an individual {@code keyDown}/{@code keyUp} call.
     */
    public void replay(TickListener tickListener) {
        for (int tick = 0; tick < ticks.size(); tick++) {
            if (tickListener != null) {
                tickListener.onTick(tick);
            }
            for (Event event : ticks.get(tick)) {
                if (processor == null) {
                    continue;
                }
                if (event.pressed) {
                    processor.keyDown(event.keycode);
                } else {
                    processor.keyUp(event.keycode);
                }
            }
        }
    }
}
