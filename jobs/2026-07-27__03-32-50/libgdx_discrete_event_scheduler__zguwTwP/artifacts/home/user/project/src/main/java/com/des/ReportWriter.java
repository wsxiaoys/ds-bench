package com.des;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class ReportWriter {

    private ReportWriter() {
    }

    public static void write(Simulation sim, Path outPath) throws IOException {
        Scenario scenario = sim.getScenario();
        StringBuilder sb = new StringBuilder();

        sb.append("TRANSCRIPT\n");
        for (String line : sim.getTranscript()) {
            sb.append(line).append('\n');
        }

        sb.append("METRICS\n");
        for (Job job : scenario.jobs) {
            sb.append("job ").append(job.id)
                    .append(" wait ").append(job.wait())
                    .append(" turnaround ").append(job.turnaround())
                    .append('\n');
        }

        sb.append("STATS\n");

        long waitSum = 0;
        for (Job job : scenario.jobs) {
            waitSum += job.wait();
        }
        int numJobs = scenario.jobs.size();
        String meanWait = numJobs == 0 ? "0.000" : formatRatio(waitSum, numJobs);
        sb.append("mean_wait ").append(meanWait).append('\n');
        sb.append("max_queue ").append(sim.getMaxQueue()).append('\n');

        long[] busyTime = new long[scenario.numServers];
        for (Job job : scenario.jobs) {
            if (job.server >= 0) {
                busyTime[job.server] += (long) (job.departureTime - job.serviceStartTime);
            }
        }
        int endTime = sim.getLastDepartTime();
        for (int i = 0; i < scenario.numServers; i++) {
            String utilization = endTime == 0 ? "0.000" : formatRatio(busyTime[i], endTime);
            sb.append("server ").append(i).append(" utilization ").append(utilization).append('\n');
        }

        Path parent = outPath.toAbsolutePath().getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        Files.write(outPath, sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static String formatRatio(long numerator, long denominator) {
        BigDecimal bd = new BigDecimal(numerator)
                .divide(new BigDecimal(denominator), 3, RoundingMode.HALF_UP);
        return bd.toPlainString();
    }
}
