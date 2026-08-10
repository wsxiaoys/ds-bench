package com.des;

import java.util.List;

public final class Scenario {
    public final int numServers;
    public final String discipline; // "FIFO" or "SJF"
    public final List<Job> jobs; // in file order

    public Scenario(int numServers, String discipline, List<Job> jobs) {
        this.numServers = numServers;
        this.discipline = discipline;
        this.jobs = jobs;
    }
}
