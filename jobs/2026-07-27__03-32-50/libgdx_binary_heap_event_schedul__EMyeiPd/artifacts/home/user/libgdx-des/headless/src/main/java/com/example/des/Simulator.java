package com.example.des;

import com.badlogic.gdx.utils.BinaryHeap;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Deterministic discrete-event simulator for a single-machine, multi-slot
 * FIFO queueing system. The scheduler is a libGDX {@link BinaryHeap} (min-heap,
 * keyed on event time) storing {@link EventNode} instances.
 */
public final class Simulator {

    private Simulator() {
    }

    /** Parsed, immutable scenario configuration plus the ordered list of initial ARRIVE events. */
    private static final class Scenario {
        int capacity = -1;
        float service = Float.NaN;
        float end = Float.NaN;
        boolean hasCapacity = false;
        boolean hasService = false;
        boolean hasEnd = false;
        final List<String[]> arrives = new ArrayList<>(); // each entry: {timeStr, jobId}
    }

    public static void run(Path inputPath, Path outputPath) throws IOException {
        Scenario scenario = parse(inputPath);

        if (!scenario.hasCapacity) throw new IllegalArgumentException("Missing CAPACITY directive");
        if (!scenario.hasService) throw new IllegalArgumentException("Missing SERVICE directive");
        if (!scenario.hasEnd) throw new IllegalArgumentException("Missing END directive");

        int capacity = scenario.capacity;
        float service = scenario.service;
        float end = scenario.end;

        // Min-heap keyed on event time (the default BinaryHeap() constructor is a min-heap).
        BinaryHeap<EventNode> heap = new BinaryHeap<>();

        long seq = 0;
        for (String[] arr : scenario.arrives) {
            float time = Float.parseFloat(arr[0]);
            String jobId = arr[1];
            EventNode node = new EventNode(time, EventType.ARRIVE, jobId, seq);
            seq++;
            heap.add(node);
        }

        Map<String, Float> arrivalTime = new HashMap<>();
        Deque<String> queue = new ArrayDeque<>();
        int busy = 0;
        long completed = 0;
        int maxQueue = 0;
        double waitSum = 0.0;
        long waitCount = 0;

        List<String> outputLines = new ArrayList<>();

        while (heap.notEmpty()) {
            EventNode first = heap.pop();
            float minValue = first.getValue();

            if (end >= 0 && minValue > end) {
                // Stop immediately: do not log this event, do not process anything remaining.
                break;
            }

            // Drain every node sharing the exact same minimal time value; a plain BinaryHeap
            // does not guarantee any particular order among ties, so we collect the whole
            // tied group and re-order it deterministically by insertion sequence. Any event
            // scheduled *during* processing of this batch has a strictly greater time
            // (DEPART events fire at now + SERVICE, SERVICE > 0), so it can never join this
            // batch; draining the tied group up front is therefore safe.
            List<EventNode> batch = new ArrayList<>();
            batch.add(first);
            while (heap.notEmpty() && heap.peek().getValue() == minValue) {
                batch.add(heap.pop());
            }
            batch.sort(Comparator.comparingLong(n -> n.seq));

            for (EventNode ev : batch) {
                float t = ev.getValue();

                outputLines.add(fmt(t) + " " + ev.type.name() + " " + ev.jobId);

                if (ev.type == EventType.ARRIVE) {
                    arrivalTime.put(ev.jobId, t);
                    queue.addLast(ev.jobId);
                } else { // DEPART
                    busy--;
                    completed++;
                }

                // dispatch: admit waiting jobs while slots are free.
                while (busy < capacity && !queue.isEmpty()) {
                    String h = queue.pollFirst();
                    float arrived = arrivalTime.get(h);
                    float wait = t - arrived;
                    waitSum += wait;
                    waitCount++;
                    busy++;
                    float departTime = t + service;
                    EventNode departEvent = new EventNode(departTime, EventType.DEPART, h, seq);
                    seq++;
                    heap.add(departEvent);
                }

                if (queue.size() > maxQueue) {
                    maxQueue = queue.size();
                }
            }
        }

        double avgWait = waitCount == 0 ? 0.0 : (waitSum / waitCount);

        StringBuilder sb = new StringBuilder();
        for (String line : outputLines) {
            sb.append(line).append('\n');
        }
        sb.append("STATS completed=").append(completed)
                .append(" max_queue=").append(maxQueue)
                .append(" avg_wait=").append(fmt(avgWait))
                .append('\n');

        try (BufferedWriter writer = Files.newBufferedWriter(outputPath, StandardCharsets.UTF_8)) {
            writer.write(sb.toString());
        }
    }

    private static Scenario parse(Path inputPath) throws IOException {
        Scenario scenario = new Scenario();
        List<String> lines = Files.readAllLines(inputPath, StandardCharsets.UTF_8);

        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }

            String[] tokens = line.split("[ \t]+");

            switch (tokens[0]) {
                case "CAPACITY":
                    scenario.capacity = Integer.parseInt(tokens[1]);
                    scenario.hasCapacity = true;
                    break;
                case "SERVICE":
                    scenario.service = Float.parseFloat(tokens[1]);
                    scenario.hasService = true;
                    break;
                case "END":
                    scenario.end = Float.parseFloat(tokens[1]);
                    scenario.hasEnd = true;
                    break;
                default:
                    // Expect: <time> ARRIVE <jobid>
                    if (tokens.length != 3 || !"ARRIVE".equals(tokens[1])) {
                        throw new IllegalArgumentException("Malformed line: " + rawLine);
                    }
                    scenario.arrives.add(new String[]{tokens[0], tokens[2]});
                    break;
            }
        }

        return scenario;
    }

    private static String fmt(float v) {
        return String.format(Locale.ROOT, "%.3f", v);
    }

    private static String fmt(double v) {
        return String.format(Locale.ROOT, "%.3f", v);
    }
}
