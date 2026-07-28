package com.simulation;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.utils.BinaryHeap;
import com.badlogic.gdx.utils.EventHeap;
import com.badlogic.gdx.utils.EventHeap.Event;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

public class Main implements ApplicationListener {
    private final String scenarioPath;
    private final String outPath;

    public Main(String scenarioPath, String outPath) {
        this.scenarioPath = scenarioPath;
        this.outPath = outPath;
    }

    public static void main(String[] args) {
        String scenarioPath = null;
        String outPath = null;
        for (int i = 0; i < args.length; i++) {
            if (args[i].equals("--scenario") && i + 1 < args.length) {
                scenarioPath = args[i+1];
            } else if (args[i].equals("--out") && i + 1 < args.length) {
                outPath = args[i+1];
            }
        }
        if (scenarioPath == null || outPath == null) {
            System.err.println("Usage: --scenario <path> --out <path>");
            System.exit(1);
        }

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        new HeadlessApplication(new Main(scenarioPath, outPath), config);
    }

    public static class Job {
        public final String jobId;
        public final int arrivalTime;
        public final int serviceDuration;
        public final int fileOrder;

        public int serviceStartTime = -1;
        public int departureTime = -1;
        public int enqueueOrder = -1;

        public Job(String jobId, int arrivalTime, int serviceDuration, int fileOrder) {
            this.jobId = jobId;
            this.arrivalTime = arrivalTime;
            this.serviceDuration = serviceDuration;
            this.fileOrder = fileOrder;
        }
    }

    private int N = -1;
    private String discipline = null;
    private final List<Job> jobs = new ArrayList<>();
    private final Map<String, Job> jobMap = new HashMap<>();

    private final BinaryHeap<Event> heap = new EventHeap();
    private int sequenceCounter = 0;
    private int enqueueCounter = 0;
    private int currentTime = 0;
    private int maxQueue = 0;
    private long[] serverBusyTime;
    private boolean[] serversBusy;
    private final List<Job> waitingQueue = new ArrayList<>();
    private final List<String> transcript = new ArrayList<>();
    private int simulationEndTime = 0;

    @Override
    public void create() {
        try {
            parseScenario();
            initializeSimulation();
        } catch (Exception e) {
            e.printStackTrace();
            Gdx.app.exit();
        }
    }

    private void parseScenario() throws IOException {
        List<String> lines = Files.readAllLines(Paths.get(scenarioPath), StandardCharsets.UTF_8);
        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty()) {
                continue;
            }
            String[] tokens = line.split("\\s+");
            if (tokens[0].equals("servers")) {
                N = Integer.parseInt(tokens[1]);
            } else if (tokens[0].equals("discipline")) {
                discipline = tokens[1];
            } else {
                String jobId = tokens[0];
                int arrivalTime = Integer.parseInt(tokens[1]);
                int serviceDuration = Integer.parseInt(tokens[2]);
                Job job = new Job(jobId, arrivalTime, serviceDuration, jobs.size());
                jobs.add(job);
                jobMap.put(jobId, job);
            }
        }
        serverBusyTime = new long[N];
        serversBusy = new boolean[N];
    }

    private void initializeSimulation() {
        for (Job job : jobs) {
            int seq = sequenceCounter++;
            heap.add(new Event(job.arrivalTime, 2, seq, job.jobId, -1, "ARRIVE"));
        }
    }

    @Override
    public void render() {
        try {
            if (heap.size > 0) {
                while (heap.size > 0) {
                    Event event = heap.pop();
                    currentTime = event.time;

                    if (event.typeName.equals("ARRIVE")) {
                        transcript.add("t " + event.time + " ARRIVE " + event.jobId);

                        Job job = jobMap.get(event.jobId);
                        job.enqueueOrder = enqueueCounter++;
                        waitingQueue.add(job);
                        maxQueue = Math.max(maxQueue, waitingQueue.size());

                        runDispatch();
                    } else if (event.typeName.equals("START_SERVICE")) {
                        transcript.add("t " + event.time + " START_SERVICE " + event.jobId + " server " + event.serverIndex);

                        Job job = jobMap.get(event.jobId);
                        job.serviceStartTime = currentTime;

                        int seq = sequenceCounter++;
                        heap.add(new Event(currentTime + job.serviceDuration, 0, seq, job.jobId, event.serverIndex, "DEPART"));
                    } else if (event.typeName.equals("DEPART")) {
                        transcript.add("t " + event.time + " DEPART " + event.jobId + " server " + event.serverIndex);

                        Job job = jobMap.get(event.jobId);
                        job.departureTime = currentTime;
                        serverBusyTime[event.serverIndex] += (job.departureTime - job.serviceStartTime);
                        simulationEndTime = currentTime;

                        serversBusy[event.serverIndex] = false;

                        runDispatch();
                    }
                }

                writeReport();
                Gdx.app.exit();
            }
        } catch (Exception e) {
            e.printStackTrace();
            Gdx.app.exit();
        }
    }

    private void runDispatch() {
        while (true) {
            int selectedServer = -1;
            for (int i = 0; i < N; i++) {
                if (!serversBusy[i]) {
                    selectedServer = i;
                    break;
                }
            }

            if (selectedServer == -1 || waitingQueue.isEmpty()) {
                break;
            }

            Job selectedJob = null;
            if (discipline.equals("FIFO")) {
                selectedJob = waitingQueue.remove(0);
            } else if (discipline.equals("SJF")) {
                int bestIndex = 0;
                Job bestJob = waitingQueue.get(0);
                for (int i = 1; i < waitingQueue.size(); i++) {
                    Job currentJob = waitingQueue.get(i);
                    if (currentJob.serviceDuration < bestJob.serviceDuration) {
                        bestJob = currentJob;
                        bestIndex = i;
                    } else if (currentJob.serviceDuration == bestJob.serviceDuration) {
                        if (currentJob.enqueueOrder < bestJob.enqueueOrder) {
                            bestJob = currentJob;
                            bestIndex = i;
                        }
                    }
                }
                selectedJob = waitingQueue.remove(bestIndex);
            }

            serversBusy[selectedServer] = true;

            int seq = sequenceCounter++;
            heap.add(new Event(currentTime, 1, seq, selectedJob.jobId, selectedServer, "START_SERVICE"));
        }
    }

    private void writeReport() throws IOException {
        Path outFilePath = Paths.get(outPath);
        if (outFilePath.getParent() != null) {
            Files.createDirectories(outFilePath.getParent());
        }

        List<String> reportLines = new ArrayList<>();
        reportLines.add("TRANSCRIPT");
        reportLines.addAll(transcript);

        reportLines.add("METRICS");
        for (Job job : jobs) {
            int wait = job.serviceStartTime - job.arrivalTime;
            int turnaround = job.departureTime - job.arrivalTime;
            reportLines.add("job " + job.jobId + " wait " + wait + " turnaround " + turnaround);
        }

        reportLines.add("STATS");
        long totalWait = 0;
        for (Job job : jobs) {
            totalWait += (job.serviceStartTime - job.arrivalTime);
        }
        BigDecimal meanWait = BigDecimal.valueOf(totalWait)
                .divide(BigDecimal.valueOf(jobs.size()), 3, RoundingMode.HALF_UP)
                .setScale(3, RoundingMode.HALF_UP);
        reportLines.add("mean_wait " + meanWait.toPlainString());
        reportLines.add("max_queue " + maxQueue);

        for (int i = 0; i < N; i++) {
            BigDecimal utilization;
            if (simulationEndTime == 0) {
                utilization = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
            } else {
                utilization = BigDecimal.valueOf(serverBusyTime[i])
                        .divide(BigDecimal.valueOf(simulationEndTime), 3, RoundingMode.HALF_UP)
                        .setScale(3, RoundingMode.HALF_UP);
            }
            reportLines.add("server " + i + " utilization " + utilization.toPlainString());
        }

        Files.write(outFilePath, reportLines, StandardCharsets.UTF_8);
    }

    @Override
    public void resize(int width, int height) {}

    @Override
    public void pause() {}

    @Override
    public void resume() {}

    @Override
    public void dispose() {}
}
