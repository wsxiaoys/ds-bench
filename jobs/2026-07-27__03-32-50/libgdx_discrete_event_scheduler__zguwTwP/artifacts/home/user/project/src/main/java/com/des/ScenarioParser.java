package com.des;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Parses a scenario description text file into a {@link Scenario}.
 */
public final class ScenarioParser {

    private ScenarioParser() {
    }

    public static Scenario parse(Path path) throws IOException {
        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);

        List<String[]> nonBlank = new ArrayList<>();
        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isEmpty()) {
                continue;
            }
            String[] tokens = line.split("\\s+");
            nonBlank.add(tokens);
        }

        if (nonBlank.size() < 2) {
            throw new IllegalArgumentException("Scenario file must contain at least the 'servers' and 'discipline' lines");
        }

        String[] serversLine = nonBlank.get(0);
        if (serversLine.length != 2 || !serversLine[0].equals("servers")) {
            throw new IllegalArgumentException("Expected line 1 to be: servers <N>");
        }
        int numServers = Integer.parseInt(serversLine[1]);
        if (numServers < 1) {
            throw new IllegalArgumentException("Number of servers must be >= 1");
        }

        String[] disciplineLine = nonBlank.get(1);
        if (disciplineLine.length != 2 || !disciplineLine[0].equals("discipline")) {
            throw new IllegalArgumentException("Expected line 2 to be: discipline <FIFO|SJF>");
        }
        String discipline = disciplineLine[1];
        if (!discipline.equals("FIFO") && !discipline.equals("SJF")) {
            throw new IllegalArgumentException("Discipline must be FIFO or SJF, got: " + discipline);
        }

        List<Job> jobs = new ArrayList<>();
        Set<String> seenIds = new LinkedHashSet<>();
        for (int i = 2; i < nonBlank.size(); i++) {
            String[] tokens = nonBlank.get(i);
            if (tokens.length != 3) {
                throw new IllegalArgumentException("Expected job line: <jobId> <arrivalTime> <serviceDuration>, got: "
                        + String.join(" ", tokens));
            }
            String jobId = tokens[0];
            if (!jobId.matches("[A-Za-z0-9_]+")) {
                throw new IllegalArgumentException("Invalid jobId: " + jobId);
            }
            if (!seenIds.add(jobId)) {
                throw new IllegalArgumentException("Duplicate jobId: " + jobId);
            }
            int arrivalTime = Integer.parseInt(tokens[1]);
            int serviceDuration = Integer.parseInt(tokens[2]);
            if (arrivalTime < 0) {
                throw new IllegalArgumentException("arrivalTime must be >= 0 for job " + jobId);
            }
            if (serviceDuration < 1) {
                throw new IllegalArgumentException("serviceDuration must be >= 1 for job " + jobId);
            }
            jobs.add(new Job(jobId, arrivalTime, serviceDuration));
        }

        return new Scenario(numServers, discipline, jobs);
    }
}
