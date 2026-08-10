package com.des;

/**
 * A single job in the queueing scenario.
 */
public final class Job {
    public final String id;
    public final int arrivalTime;
    public final int serviceDuration;

    /** Set when a START_SERVICE event for this job is processed. -1 until then. */
    public int serviceStartTime = -1;
    /** Set when a DEPART event for this job is processed. -1 until then. */
    public int departureTime = -1;
    /** Index of the server that served this job. -1 until assigned. */
    public int server = -1;

    public Job(String id, int arrivalTime, int serviceDuration) {
        this.id = id;
        this.arrivalTime = arrivalTime;
        this.serviceDuration = serviceDuration;
    }

    public int wait() {
        return serviceStartTime - arrivalTime;
    }

    public int turnaround() {
        return departureTime - arrivalTime;
    }
}
