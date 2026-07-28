package com.example.astar;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;

/**
 * Holds a parsed scenario: the tile-weight grid plus the list of queries.
 * The scenario file format is whitespace-separated non-negative integers:
 *
 * <pre>
 * R C
 * (R lines of C integers: tile weights, 0 = wall)
 * Q
 * (Q lines of 4 integers: SR SC GR GC)
 * </pre>
 */
final class Scenario {

    final int rows;
    final int cols;
    final int[] weights; // size rows*cols, row-major, 0 = wall
    final int[] queries; // size 4*Q: SR,SC,GR,GC per query

    private Scenario(int rows, int cols, int[] weights, int[] queries) {
        this.rows = rows;
        this.cols = cols;
        this.weights = weights;
        this.queries = queries;
    }

    static Scenario read(String path) throws IOException {
        byte[] data = Files.readAllBytes(Paths.get(path));
        IntTokenizer tok = new IntTokenizer(data);

        int rows = tok.next();
        int cols = tok.next();
        int cellCount = rows * cols;
        int[] weights = new int[cellCount];
        for (int i = 0; i < cellCount; i++) {
            weights[i] = tok.next();
        }

        int q = tok.next();
        int[] queries = new int[4 * q];
        for (int i = 0; i < queries.length; i++) {
            queries[i] = tok.next();
        }

        return new Scenario(rows, cols, weights, queries);
    }

    /** Minimal, fast whitespace-separated non-negative integer tokenizer over a byte array. */
    private static final class IntTokenizer {
        private final byte[] data;
        private int pos;

        IntTokenizer(byte[] data) {
            this.data = data;
            this.pos = 0;
        }

        int next() {
            int len = data.length;
            while (pos < len && isWhitespace(data[pos])) {
                pos++;
            }
            if (pos >= len) {
                throw new IllegalStateException("Unexpected end of scenario file while reading an integer.");
            }
            int value = 0;
            while (pos < len && data[pos] >= '0' && data[pos] <= '9') {
                value = value * 10 + (data[pos] - '0');
                pos++;
            }
            return value;
        }

        private static boolean isWhitespace(byte b) {
            return b == ' ' || b == '\n' || b == '\r' || b == '\t';
        }
    }
}
