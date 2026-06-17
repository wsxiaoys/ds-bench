package com.gdxgame;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.Writer;
import java.util.List;

/**
 * Writes the sorted collision report to an output writer.
 */
public class OutputWriter {

    private OutputWriter() {
        // utility class
    }

    /**
     * Writes the collision report. Format:
     * <pre>
     * id_a\tid_b
     * id_a\tid_b
     * ...
     * total_overlaps=N
     * </pre>
     * Trailing newline is included.
     */
    public static void write(Writer writer, List<OverlapDetector.OverlapPair> pairs) throws IOException {
        try (BufferedWriter bw = new BufferedWriter(writer)) {
            for (OverlapDetector.OverlapPair pair : pairs) {
                bw.write(pair.idA);
                bw.write('\t');
                bw.write(pair.idB);
                bw.newLine();
            }
            bw.write("total_overlaps=" + pairs.size());
            bw.newLine();
        }
    }
}
