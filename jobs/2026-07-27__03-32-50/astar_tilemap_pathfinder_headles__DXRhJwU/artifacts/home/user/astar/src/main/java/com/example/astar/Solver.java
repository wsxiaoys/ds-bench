package com.example.astar;

import com.badlogic.gdx.utils.BinaryHeap;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Weighted A* pathfinder over an 8-connected tile grid, using
 * {@link com.badlogic.gdx.utils.BinaryHeap} as the open-set / frontier.
 *
 * Movement rules:
 *  - Orthogonal step into passable tile t costs weight(t).
 *  - Diagonal step into passable tile t costs weight(t) * sqrt(2).
 *  - Diagonal moves are forbidden if either of the two orthogonally
 *    adjacent "corner" cells is out of bounds or impassable.
 *
 * Determinism: when several frontier entries share the same (float) total
 * estimated cost, the one with the larger accumulated cost-from-start is
 * preferred; remaining ties are broken by the smaller row-major cell index.
 */
final class Solver {

    private static final double SQRT2 = Math.sqrt(2.0);

    private final int rows;
    private final int cols;
    private final int[] weight; // size rows*cols; 0 = wall

    // Reused, per-run scratch state. A "stamp" versioning scheme lets us avoid
    // clearing these arrays on every query (O(1) amortized reset per cell).
    private final int[] stamp;
    private final double[] gScore;
    private final int[] cameFrom;
    private final boolean[] closed;
    private final boolean[] inOpen;
    private int currentStamp = 0;

    private final BinaryHeap<CellNode> heap = new BinaryHeap<>();
    private final CellNode[] nodePool;

    // Neighbor offsets: 4 orthogonal + 4 diagonal.
    private static final int[] DR = {-1, 1, 0, 0, -1, -1, 1, 1};
    private static final int[] DC = {0, 0, -1, 1, -1, 1, -1, 1};

    Solver(int rows, int cols, int[] weight) {
        this.rows = rows;
        this.cols = cols;
        this.weight = weight;
        int n = rows * cols;
        this.stamp = new int[n];
        this.gScore = new double[n];
        this.cameFrom = new int[n];
        this.closed = new boolean[n];
        this.inOpen = new boolean[n];
        this.nodePool = new CellNode[n];
        for (int i = 0; i < n; i++) {
            nodePool[i] = new CellNode(i);
        }
    }

    /** A BinaryHeap node bound to a specific grid cell (row-major index). */
    private static final class CellNode extends BinaryHeap.Node {
        final int cell;

        CellNode(int cell) {
            super(0f);
            this.cell = cell;
        }
    }

    void solveAll(int[] queries, String outputPath) throws IOException {
        int q = queries.length / 4;
        try (BufferedWriter out = Files.newBufferedWriter(Paths.get(outputPath), StandardCharsets.UTF_8)) {
            for (int i = 0; i < q; i++) {
                int sr = queries[4 * i];
                int sc = queries[4 * i + 1];
                int gr = queries[4 * i + 2];
                int gc = queries[4 * i + 3];
                out.write(solveQuery(sr, sc, gr, gc));
                out.write('\n');
            }
        }
    }

    private String solveQuery(int sr, int sc, int gr, int gc) {
        int start = sr * cols + sc;
        int goal = gr * cols + gc;

        if (weight[start] == 0 || weight[goal] == 0) {
            return "NO_PATH";
        }
        if (start == goal) {
            return String.format(Locale.ROOT, "0.000 1 %d,%d", sr, sc);
        }

        currentStamp++;
        heap.clear();

        touch(start);
        gScore[start] = 0.0;
        cameFrom[start] = -1;

        double h0 = heuristic(sr, sc, gr, gc);
        heap.add(nodePool[start], (float) h0);
        inOpen[start] = true;

        while (heap.notEmpty()) {
            int current = popBest();
            inOpen[current] = false;

            if (current == goal) {
                return buildResult(start, goal);
            }
            closed[current] = true;

            int r = current / cols;
            int c = current % cols;

            for (int dir = 0; dir < 8; dir++) {
                int dr = DR[dir];
                int dc = DC[dir];
                int nr = r + dr;
                int nc = c + dc;
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                    continue;
                }
                int nb = nr * cols + nc;
                if (weight[nb] == 0) {
                    continue;
                }

                boolean diagonal = dr != 0 && dc != 0;
                if (diagonal) {
                    int r1 = r + dr, c1 = c;      // (r+dr, c)
                    int r2 = r, c2 = c + dc;      // (r, c+dc)
                    if (!passable(r1, c1) || !passable(r2, c2)) {
                        continue;
                    }
                }

                touch(nb);
                if (closed[nb]) {
                    continue;
                }

                double stepCost = diagonal ? weight[nb] * SQRT2 : weight[nb];
                double tentativeG = gScore[current] + stepCost;

                if (tentativeG < gScore[nb]) {
                    gScore[nb] = tentativeG;
                    cameFrom[nb] = current;
                    double f = tentativeG + heuristic(nr, nc, gr, gc);
                    if (inOpen[nb]) {
                        heap.setValue(nodePool[nb], (float) f);
                    } else {
                        heap.add(nodePool[nb], (float) f);
                        inOpen[nb] = true;
                    }
                }
            }
        }

        return "NO_PATH";
    }

    private boolean passable(int r, int c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) {
            return false;
        }
        return weight[r * cols + c] != 0;
    }

    /** Lazily (re)initializes per-query scratch state for a cell, based on the stamp. */
    private void touch(int cell) {
        if (stamp[cell] != currentStamp) {
            stamp[cell] = currentStamp;
            gScore[cell] = Double.POSITIVE_INFINITY;
            cameFrom[cell] = -1;
            closed[cell] = false;
            inOpen[cell] = false;
        }
    }

    private double heuristic(int r, int c, int gr, int gc) {
        int dx = Math.abs(gr - r);
        int dy = Math.abs(gc - c);
        int mn = Math.min(dx, dy);
        int mx = Math.max(dx, dy);
        // Admissible for weight >= 1: diagonal steps cost >= 1*sqrt(2), orthogonal >= 1.
        return (mx - mn) + mn * SQRT2;
    }

    /**
     * Pops the true minimum-key node from the heap, resolving exact ties among
     * equal (float) keys deterministically: prefer larger accumulated g, then
     * smaller row-major cell index. Any losing tied nodes are pushed back.
     */
    private int popBest() {
        CellNode root = heap.pop();
        float minVal = root.value;
        CellNode best = root;
        List<CellNode> losers = null;

        while (heap.notEmpty() && heap.peek().value == minVal) {
            CellNode candidate = heap.pop();
            if (isBetterCandidate(candidate, best)) {
                if (losers == null) {
                    losers = new ArrayList<>();
                }
                losers.add(best);
                best = candidate;
            } else {
                if (losers == null) {
                    losers = new ArrayList<>();
                }
                losers.add(candidate);
            }
        }

        if (losers != null) {
            for (CellNode loser : losers) {
                heap.add(loser, loser.value);
            }
        }

        return best.cell;
    }

    /** True if candidate should replace best under the required tie-break rule. */
    private boolean isBetterCandidate(CellNode candidate, CellNode best) {
        double gc = gScore[candidate.cell];
        double gb = gScore[best.cell];
        if (gc != gb) {
            return gc > gb;
        }
        return candidate.cell < best.cell;
    }

    private String buildResult(int start, int goal) {
        List<Integer> path = new ArrayList<>();
        int cur = goal;
        while (true) {
            path.add(cur);
            if (cur == start) {
                break;
            }
            cur = cameFrom[cur];
        }
        Collections.reverse(path);

        StringBuilder sb = new StringBuilder();
        sb.append(String.format(Locale.ROOT, "%.3f", gScore[goal]));
        sb.append(' ').append(path.size());
        for (int cell : path) {
            int r = cell / cols;
            int c = cell % cols;
            sb.append(' ').append(r).append(',').append(c);
        }
        return sb.toString();
    }
}
