package com.example.des;

import com.badlogic.gdx.utils.BinaryHeap;

/**
 * Custom node stored in the {@link com.badlogic.gdx.utils.BinaryHeap} scheduler.
 * The heap orders nodes purely by their {@code value} (the event time, a float).
 * Because {@link BinaryHeap} does not support a secondary sort key, ties between
 * events sharing the same time are broken explicitly by the simulator using the
 * {@link #seq} insertion-sequence number recorded here.
 */
public class EventNode extends BinaryHeap.Node {

    /** The type of event (ARRIVE or DEPART). */
    final EventType type;

    /** The job id this event pertains to. */
    final String jobId;

    /** Global insertion-sequence number, used to break ties between events with equal time. */
    final long seq;

    public EventNode(float time, EventType type, String jobId, long seq) {
        super(time);
        this.type = type;
        this.jobId = jobId;
        this.seq = seq;
    }
}
