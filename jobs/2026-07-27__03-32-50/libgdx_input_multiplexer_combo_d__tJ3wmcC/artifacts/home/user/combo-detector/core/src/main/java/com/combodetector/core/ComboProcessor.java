package com.combodetector.core;

import com.badlogic.gdx.Input.Keys;
import com.badlogic.gdx.InputAdapter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Second processor in the multiplexer chain. Tracks held directional keys, derives the current
 * numpad-notation direction, buffers direction-change tokens, and recognizes fixed
 * motion + button combos within a bounded tick window.
 */
public class ComboProcessor extends InputAdapter {

    /** Size of the sliding window (in ticks) used to gather direction tokens for a combo check. */
    public static final int WINDOW = 12;

    /** A single recognized combo, in the order it was recognized. */
    public static final class Recognition {
        public final int tick;
        public final String name;

        Recognition(int tick, String name) {
            this.tick = tick;
            this.name = name;
        }
    }

    /** Definition of a recognizable combo: the button that triggers it and its motion sequence. */
    private static final class ComboDef {
        final String name;
        final int button;
        final int[] motion;

        ComboDef(String name, int button, int[] motion) {
            this.name = name;
            this.button = button;
            this.motion = motion;
        }
    }

    // Priority order matters: checked top to bottom.
    private static final ComboDef[] COMBOS = new ComboDef[] {
        new ComboDef("HADOKEN", Keys.X, new int[] {2, 3, 6}),
        new ComboDef("SHORYUKEN", Keys.X, new int[] {6, 2, 3}),
        new ComboDef("TATSU", Keys.Z, new int[] {2, 1, 4}),
    };

    private static final class DirToken {
        final int direction;
        final int tick;

        DirToken(int direction, int tick) {
            this.direction = direction;
            this.tick = tick;
        }
    }

    private int currentTick = 0;

    private boolean up, down, left, right;
    private int lastDirection = 5;

    private final List<DirToken> buffer = new ArrayList<>();
    private final List<Recognition> log = new ArrayList<>();
    private final Map<String, Integer> tally = new LinkedHashMap<>();

    public ComboProcessor() {
        for (ComboDef c : COMBOS) {
            tally.put(c.name, 0);
        }
    }

    /** Must be called by the driver before dispatching each tick's events. */
    public void setCurrentTick(int tick) {
        this.currentTick = tick;
    }

    private static boolean isDirectional(int keycode) {
        return keycode == Keys.UP || keycode == Keys.DOWN || keycode == Keys.LEFT || keycode == Keys.RIGHT;
    }

    private int computeDirection() {
        int horiz = 0;
        if (left && !right) {
            horiz = -1;
        } else if (right && !left) {
            horiz = 1;
        }

        int vert = 0;
        if (down && !up) {
            vert = -1;
        } else if (up && !down) {
            vert = 1;
        }

        return 5 + horiz + 3 * vert;
    }

    private boolean handleDirectionalEvent(int keycode, boolean pressed) {
        switch (keycode) {
            case Keys.UP:
                up = pressed;
                break;
            case Keys.DOWN:
                down = pressed;
                break;
            case Keys.LEFT:
                left = pressed;
                break;
            case Keys.RIGHT:
                right = pressed;
                break;
            default:
                return false;
        }

        int d = computeDirection();
        if (d != lastDirection && d != 5) {
            buffer.add(new DirToken(d, currentTick));
        }
        lastDirection = d;
        return false;
    }

    private boolean handleButtonEvent(int keycode) {
        // Gather direction tokens within the window [currentTick - WINDOW, currentTick].
        List<Integer> windowed = new ArrayList<>();
        for (DirToken t : buffer) {
            if (currentTick - t.tick <= WINDOW) {
                windowed.add(t.direction);
            }
        }

        for (ComboDef combo : COMBOS) {
            if (combo.button != keycode) {
                continue;
            }
            int k = combo.motion.length;
            if (windowed.size() < k) {
                continue;
            }
            boolean matches = true;
            int offset = windowed.size() - k;
            for (int i = 0; i < k; i++) {
                if (windowed.get(offset + i) != combo.motion[i]) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                log.add(new Recognition(currentTick, combo.name));
                tally.put(combo.name, tally.get(combo.name) + 1);
                buffer.clear();
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean keyDown(int keycode) {
        if (isDirectional(keycode)) {
            return handleDirectionalEvent(keycode, true);
        }
        if (keycode == Keys.X || keycode == Keys.Z) {
            return handleButtonEvent(keycode);
        }
        return false;
    }

    @Override
    public boolean keyUp(int keycode) {
        if (isDirectional(keycode)) {
            return handleDirectionalEvent(keycode, false);
        }
        return false;
    }

    public List<Recognition> getLog() {
        return log;
    }

    public Map<String, Integer> getTally() {
        return tally;
    }
}
