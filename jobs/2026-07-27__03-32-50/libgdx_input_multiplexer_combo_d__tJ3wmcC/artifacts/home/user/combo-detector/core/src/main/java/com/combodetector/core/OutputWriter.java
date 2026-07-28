package com.combodetector.core;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/** Formats and writes the combo-detector output file. */
public final class OutputWriter {

    private OutputWriter() {
    }

    public static void write(Path outputFile, List<ComboProcessor.Recognition> log, Map<String, Integer> tally)
        throws IOException {
        StringBuilder sb = new StringBuilder();

        for (ComboProcessor.Recognition r : log) {
            sb.append("TICK ").append(r.tick).append(' ').append(r.name).append('\n');
        }

        sb.append("--- TALLY ---\n");
        sb.append("HADOKEN ").append(tally.getOrDefault("HADOKEN", 0)).append('\n');
        sb.append("SHORYUKEN ").append(tally.getOrDefault("SHORYUKEN", 0)).append('\n');
        sb.append("TATSU ").append(tally.getOrDefault("TATSU", 0)).append('\n');
        sb.append("TOTAL ").append(log.size()).append('\n');

        Path parent = outputFile.toAbsolutePath().getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        Files.write(outputFile, sb.toString().getBytes(StandardCharsets.UTF_8));
    }
}
