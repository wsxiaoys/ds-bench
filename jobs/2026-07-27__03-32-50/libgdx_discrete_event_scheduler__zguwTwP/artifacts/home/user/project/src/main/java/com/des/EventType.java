package com.des;

/**
 * Event-type priority (used for tie-breaking events that share the same
 * simulation time): DEPART before START_SERVICE before ARRIVE.
 */
public enum EventType {
    DEPART(0),
    START_SERVICE(1),
    ARRIVE(2);

    public final int priority;

    EventType(int priority) {
        this.priority = priority;
    }
}
