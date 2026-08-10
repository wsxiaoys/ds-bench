package com.des;

import com.badlogic.gdx.utils.BinaryHeap;

import java.util.ArrayList;
import java.util.List;

/**
 * Deterministic discrete-event simulation of a multi-server queue.
 *
 * <p>All events are scheduled into a libGDX {@link BinaryHeap} keyed on the
 * (float) simulation time. Every push and every pop of an event goes through
 * this heap. Because the heap's ordering key is a single float, same-time
 * ties (e.g. simultaneous arrivals, or a START_SERVICE event generated
 * reactively at the very instant it is scheduled) are resolved using an
 * explicit event-type priority and a monotonically increasing insertion
 * sequence number, exactly as required by the ordering rules. This
 * resolution never bypasses the heap: nodes are always popped out of the
 * heap first, then staged into per-time-instant buckets purely to apply the
 * secondary/tertiary tie-break before being handed back to the caller.
 *
 * <p>The engine is driven one event at a time via {@link #step()}, which is
 * intended to be called once per tick of the libGDX headless application's
 * render loop.
 */
public final class Simulation {

    private final Scenario scenario;
    private final boolean fifo;

    private final BinaryHeap<EventNode> heap = new BinaryHeap<>();
    private int seq = 0;

    private final boolean[] serverBusy;
    private final List<Job> waiting = new ArrayList<>();

    // Same-instant tie-break staging buckets.
    private Integer batchTime = null;
    private final List<EventNode> departBucket = new ArrayList<>();
    private final List<EventNode> startBucket = new ArrayList<>();
    private final List<EventNode> arriveBucket = new ArrayList<>();

    private final List<String> transcript = new ArrayList<>();
    private int maxQueue = 0;
    private int lastDepartTime = 0;
    private boolean started = false;
    private boolean finished = false;

    public Simulation(Scenario scenario) {
        this.scenario = scenario;
        this.fifo = scenario.discipline.equals("FIFO");
        this.serverBusy = new boolean[scenario.numServers];
    }

    private void ensureStarted() {
        if (started) {
            return;
        }
        started = true;
        // Initial ARRIVE events are pushed once, up front, in file order.
        for (Job job : scenario.jobs) {
            push(EventType.ARRIVE, job, -1, job.arrivalTime);
        }
    }

    private void push(EventType type, Job job, int server, int time) {
        EventNode node = new EventNode(time, type, job, server, seq);
        seq++;
        heap.add(node, (float) time);
    }

    /** Pulls any newly-available nodes at the current batch time out of the heap into buckets. */
    private void refill() {
        if (batchTime == null) {
            return;
        }
        int t = batchTime;
        while (heap.notEmpty() && heap.peek().time == t) {
            EventNode node = heap.pop();
            switch (node.type) {
                case DEPART:
                    departBucket.add(node);
                    break;
                case START_SERVICE:
                    startBucket.add(node);
                    break;
                case ARRIVE:
                    arriveBucket.add(node);
                    break;
            }
        }
    }

    private static EventNode pollLowestSeq(List<EventNode> bucket) {
        int minIdx = 0;
        for (int i = 1; i < bucket.size(); i++) {
            if (bucket.get(i).seq < bucket.get(minIdx).seq) {
                minIdx = i;
            }
        }
        return bucket.remove(minIdx);
    }

    /** Returns the next event to process in strict order, or null if the simulation is complete. */
    private EventNode nextEvent() {
        while (true) {
            refill();
            if (!departBucket.isEmpty()) {
                return pollLowestSeq(departBucket);
            }
            if (!startBucket.isEmpty()) {
                return pollLowestSeq(startBucket);
            }
            if (!arriveBucket.isEmpty()) {
                return pollLowestSeq(arriveBucket);
            }
            if (heap.isEmpty()) {
                batchTime = null;
                return null;
            }
            batchTime = heap.peek().time;
        }
    }

    /**
     * Advances the simulation by exactly one event. Intended to be called
     * once per render-loop tick.
     *
     * @return true if an event was processed, false if the simulation had
     *         already completed (nothing left to do).
     */
    public boolean step() {
        ensureStarted();
        if (finished) {
            return false;
        }
        EventNode node = nextEvent();
        if (node == null) {
            finished = true;
            return false;
        }
        process(node);
        return true;
    }

    public boolean isFinished() {
        return finished;
    }

    private void process(EventNode node) {
        switch (node.type) {
            case ARRIVE:
                transcript.add("t " + node.time + " ARRIVE " + node.job.id);
                waiting.add(node.job);
                if (waiting.size() > maxQueue) {
                    maxQueue = waiting.size();
                }
                dispatch(node.time);
                break;
            case START_SERVICE:
                transcript.add("t " + node.time + " START_SERVICE " + node.job.id + " server " + node.server);
                node.job.serviceStartTime = node.time;
                node.job.server = node.server;
                push(EventType.DEPART, node.job, node.server, node.time + node.job.serviceDuration);
                break;
            case DEPART:
                transcript.add("t " + node.time + " DEPART " + node.job.id + " server " + node.server);
                node.job.departureTime = node.time;
                serverBusy[node.server] = false;
                if (node.time > lastDepartTime) {
                    lastDepartTime = node.time;
                }
                dispatch(node.time);
                break;
        }
    }

    private void dispatch(int time) {
        while (true) {
            int serverIdx = -1;
            for (int i = 0; i < serverBusy.length; i++) {
                if (!serverBusy[i]) {
                    serverIdx = i;
                    break;
                }
            }
            if (serverIdx == -1 || waiting.isEmpty()) {
                break;
            }

            int jobIdx;
            if (fifo) {
                jobIdx = 0;
            } else {
                jobIdx = 0;
                for (int i = 1; i < waiting.size(); i++) {
                    if (waiting.get(i).serviceDuration < waiting.get(jobIdx).serviceDuration) {
                        jobIdx = i;
                    }
                }
            }

            Job job = waiting.remove(jobIdx);
            serverBusy[serverIdx] = true;
            push(EventType.START_SERVICE, job, serverIdx, time);
        }
    }

    public List<String> getTranscript() {
        return transcript;
    }

    public int getMaxQueue() {
        return maxQueue;
    }

    public int getLastDepartTime() {
        return lastDepartTime;
    }

    public Scenario getScenario() {
        return scenario;
    }
}
