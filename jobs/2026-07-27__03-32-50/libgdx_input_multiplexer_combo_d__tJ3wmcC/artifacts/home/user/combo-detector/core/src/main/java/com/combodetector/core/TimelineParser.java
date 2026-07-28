package com.combodetector.core;

import com.badlogic.gdx.Input.Keys;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Parses the input timeline text file described by the grammar: one tick per line, blank lines are
 * empty ticks, and non-blank lines are whitespace-separated {@code +NAME}/{@code -NAME} tokens
 * processed strictly left-to-right.
 */
public final class TimelineParser {

    private static final Map<String, Integer> KEY_MAP = new HashMap<>();

    static {
        KEY_MAP.put("UP", Keys.UP);
        KEY_MAP.put("DOWN", Keys.DOWN);
        KEY_MAP.put("LEFT", Keys.LEFT);
        KEY_MAP.put("RIGHT", Keys.RIGHT);
        KEY_MAP.put("PUNCH", Keys.X);
        KEY_MAP.put("KICK", Keys.Z);
        KEY_MAP.put("PAUSE", Keys.P);
    }

    private TimelineParser() {
    }

    public static List<List<TimelineMockInput.Event>> parse(Path inputFile) throws IOException {
        List<String> lines = Files.readAllLines(inputFile, StandardCharsets.UTF_8);

        List<List<TimelineMockInput.Event>> ticks = new ArrayList<>(lines.size());
        for (int tick = 0; tick < lines.size(); tick++) {
            String line = lines.get(tick);
            List<TimelineMockInput.Event> events = new ArrayList<>();

            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                for (String token : trimmed.split("\\s+")) {
                    events.add(parseToken(tick, token));
                }
            }
            ticks.add(events);
        }
        return ticks;
    }

    private static TimelineMockInput.Event parseToken(int tick, String token) {
        char sign = token.charAt(0);
        if (sign != '+' && sign != '-') {
            throw new IllegalArgumentException("Malformed event token: " + token);
        }
        String name = token.substring(1);
        Integer keycode = KEY_MAP.get(name);
        if (keycode == null) {
            throw new IllegalArgumentException("Unknown key name: " + name);
        }
        return new TimelineMockInput.Event(tick, keycode, sign == '+');
    }
}
