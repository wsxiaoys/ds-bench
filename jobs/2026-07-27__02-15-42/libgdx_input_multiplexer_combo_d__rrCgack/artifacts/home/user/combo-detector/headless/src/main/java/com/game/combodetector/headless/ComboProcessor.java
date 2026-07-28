package com.game.combodetector.headless;

import com.badlogic.gdx.InputAdapter;
import com.badlogic.gdx.Input.Keys;
import java.io.BufferedWriter;
import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class ComboProcessor extends InputAdapter {
    public static class DirectionToken {
        public final int direction;
        public final int tick;

        public DirectionToken(int direction, int tick) {
            this.direction = direction;
            this.tick = tick;
        }

        @Override
        public String toString() {
            return "(" + direction + ", " + tick + ")";
        }
    }

    public static class Combo {
        public final String name;
        public final int buttonKey;
        public final int[] motion;

        public Combo(String name, int buttonKey, int[] motion) {
            this.name = name;
            this.buttonKey = buttonKey;
            this.motion = motion;
        }
    }

    private final ReplayInput replayInput;
    private final List<Combo> combos = List.of(
        new Combo("HADOKEN", Keys.X, new int[]{2, 3, 6}),
        new Combo("SHORYUKEN", Keys.X, new int[]{6, 2, 3}),
        new Combo("TATSU", Keys.Z, new int[]{2, 1, 4})
    );

    private final List<DirectionToken> directionBuffer = new ArrayList<>();
    private final List<String> recognizedLog = new ArrayList<>();
    private final int[] tally = new int[3]; // HADOKEN=0, SHORYUKEN=1, TATSU=2
    private int totalCount = 0;

    private int lastDirection = 5;

    // Held state for directional keys
    private boolean upHeld = false;
    private boolean downHeld = false;
    private boolean leftHeld = false;
    private boolean rightHeld = false;

    public ComboProcessor(ReplayInput replayInput) {
        this.replayInput = replayInput;
    }

    private boolean isDirectionalKey(int keycode) {
        return keycode == Keys.UP || keycode == Keys.DOWN || keycode == Keys.LEFT || keycode == Keys.RIGHT;
    }

    private void updateHeldState(int keycode, boolean pressed) {
        if (keycode == Keys.UP) upHeld = pressed;
        else if (keycode == Keys.DOWN) downHeld = pressed;
        else if (keycode == Keys.LEFT) leftHeld = pressed;
        else if (keycode == Keys.RIGHT) rightHeld = pressed;
    }

    private int computeDirection() {
        int h = 0;
        if (leftHeld && !rightHeld) h = -1;
        else if (rightHeld && !leftHeld) h = 1;

        int v = 0;
        if (upHeld && !downHeld) v = 1;
        else if (downHeld && !upHeld) v = -1;

        if (h == -1 && v == -1) return 1;
        if (h == 0 && v == -1) return 2;
        if (h == 1 && v == -1) return 3;
        if (h == -1 && v == 0) return 4;
        if (h == 0 && v == 0) return 5;
        if (h == 1 && v == 0) return 6;
        if (h == -1 && v == 1) return 7;
        if (h == 0 && v == 1) return 8;
        if (h == 1 && v == 1) return 9;
        return 5;
    }

    private boolean handleButtonDown(int keycode, int currentTick) {
        // Filter directionBuffer for T - t <= 12
        List<DirectionToken> B = new ArrayList<>();
        for (DirectionToken token : directionBuffer) {
            if (currentTick - token.tick <= 12) {
                B.add(token);
            }
        }

        // Check combos in priority order
        for (int comboIdx = 0; comboIdx < combos.size(); comboIdx++) {
            Combo combo = combos.get(comboIdx);
            if (combo.buttonKey == keycode) {
                int k = combo.motion.length;
                if (B.size() >= k) {
                    boolean match = true;
                    for (int i = 0; i < k; i++) {
                        if (B.get(B.size() - k + i).direction != combo.motion[i]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) {
                        // Recognized!
                        recognizedLog.add("TICK " + currentTick + " " + combo.name);
                        tally[comboIdx]++;
                        totalCount++;
                        directionBuffer.clear();
                        return true; // consumes the event
                    }
                }
            }
        }

        return false;
    }

    @Override
    public boolean keyDown(int keycode) {
        int currentTick = replayInput.getCurrentTick();

        if (isDirectionalKey(keycode)) {
            updateHeldState(keycode, true);
            int d = computeDirection();
            if (d != lastDirection) {
                if (d != 5) {
                    directionBuffer.add(new DirectionToken(d, currentTick));
                }
                lastDirection = d;
            }
            return false; // direction events never consume
        }

        if (keycode == Keys.X || keycode == Keys.Z) {
            return handleButtonDown(keycode, currentTick);
        }

        return false;
    }

    @Override
    public boolean keyUp(int keycode) {
        int currentTick = replayInput.getCurrentTick();

        if (isDirectionalKey(keycode)) {
            updateHeldState(keycode, false);
            int d = computeDirection();
            if (d != lastDirection) {
                if (d != 5) {
                    directionBuffer.add(new DirectionToken(d, currentTick));
                }
                lastDirection = d;
            }
            return false; // direction events never consume
        }

        return false;
    }

    public void writeResults(String outputFilePath) throws IOException {
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(outputFilePath))) {
            for (String logLine : recognizedLog) {
                writer.write(logLine);
                writer.write("\n");
            }
            writer.write("--- TALLY ---\n");
            writer.write("HADOKEN " + tally[0] + "\n");
            writer.write("SHORYUKEN " + tally[1] + "\n");
            writer.write("TATSU " + tally[2] + "\n");
            writer.write("TOTAL " + totalCount + "\n");
        }
    }
}
