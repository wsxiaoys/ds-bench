package com.des;

import com.badlogic.gdx.utils.BinaryHeap;

/**
 * A node scheduled into the libGDX {@link BinaryHeap}. The heap orders nodes
 * purely by the (float) {@code value}, which we set to the integer
 * simulation time of the event. Because the heap's key space is a single
 * float, it alone cannot express the full (time, type-priority, sequence)
 * ordering demanded by the spec. We therefore use the heap strictly for
 * primary (time) ordering -- every event, without exception, is pushed and
 * popped through it -- and resolve ties between events that share the same
 * time using the {@link #type} priority and {@link #seq} fields, which are
 * carried alongside the heap key on this node.
 */
public final class EventNode extends BinaryHeap.Node {
    public final int time;
    public final EventType type;
    public final Job job;
    public final int server;
    public final int seq;

    public EventNode(int time, EventType type, Job job, int server, int seq) {
        super((float) time);
        this.time = time;
        this.type = type;
        this.job = job;
        this.server = server;
        this.seq = seq;
    }
}
