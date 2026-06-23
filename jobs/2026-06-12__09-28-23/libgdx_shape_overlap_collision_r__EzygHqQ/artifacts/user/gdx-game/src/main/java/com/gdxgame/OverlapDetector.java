package com.gdxgame;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * Computes all overlapping pairs from a list of shapes using libGDX's
 * geometry primitives.
 */
public class OverlapDetector {

    private OverlapDetector() {
        // utility class
    }

    /**
     * Represents an unordered pair of overlapping shapes, identified by their IDs.
     */
    public static final class OverlapPair {
        public final String idA; // lexicographically smaller
        public final String idB; // lexicographically larger

        public OverlapPair(String idA, String idB) {
            if (idA.compareTo(idB) <= 0) {
                this.idA = idA;
                this.idB = idB;
            } else {
                this.idA = idB;
                this.idB = idA;
            }
        }
    }

    /**
     * Computes all distinct overlapping pairs from the given shape list.
     * Each unordered pair is reported at most once, with the lexicographically
     * smaller ID first.
     */
    public static List<OverlapPair> findOverlaps(List<Shape> shapes) {
        List<OverlapPair> pairs = new ArrayList<>();

        for (int i = 0; i < shapes.size(); i++) {
            Shape a = shapes.get(i);
            for (int j = i + 1; j < shapes.size(); j++) {
                Shape b = shapes.get(j);
                if (a.overlaps(b)) {
                    pairs.add(new OverlapPair(a.getId(), b.getId()));
                }
            }
        }

        // Sort: primary key idA, secondary key idB
        Collections.sort(pairs, Comparator.comparing((OverlapPair p) -> p.idA)
                .thenComparing(p -> p.idB));

        return pairs;
    }
}
