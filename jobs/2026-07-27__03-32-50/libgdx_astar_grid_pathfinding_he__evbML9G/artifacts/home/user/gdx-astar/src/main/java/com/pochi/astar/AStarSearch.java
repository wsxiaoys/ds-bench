package com.pochi.astar;

import com.badlogic.gdx.utils.BinaryHeap;

/**
 * Weighted A* search over the 8-connected weighted grid described by
 * {@link GridMap}. The open set / frontier is a min-priority queue built on
 * top of {@link com.badlogic.gdx.utils.BinaryHeap}, using {@link CellNode} as
 * the custom node type (never {@code java.util.PriorityQueue} or any other
 * JDK tree/heap collection).
 *
 * <p>This search always runs to completion (the frontier is drained
 * entirely) rather than stopping as soon as a single target is reached. That
 * is required here because the caller needs the true shortest-path distance
 * from every reachable cell back to the search's source cell, so that the
 * lexicographically-smallest optimal path can later be reconstructed greedily
 * (see {@link PathfinderApplication}). An optional heuristic (octile
 * distance to a reference cell, scaled by the minimum possible per-step
 * terrain cost) is used to order the frontier; when no reference cell is
 * supplied the heuristic is identically zero and the search degenerates to
 * plain Dijkstra, itself a valid special case of weighted A*.
 */
final class AStarSearch {

    /** Smallest possible terrain digit, used to keep the heuristic admissible. */
    private static final double MIN_TERRAIN_COST = 1.0;
    private static final double SQRT2 = Math.sqrt(2.0);

    private final GridMap map;

    AStarSearch(GridMap map) {
        this.map = map;
    }

    /**
     * Runs weighted A* from {@code (srcRow, srcCol)} over the whole grid and
     * returns a {@code double[rows][cols]} array with the minimum path cost
     * from the source to every cell ({@link Double#POSITIVE_INFINITY} for
     * cells that are walls or unreachable).
     *
     * @param heuristicRefRow row of a reference cell used only to bias
     *                        frontier ordering (may be -1 to disable).
     * @param heuristicRefCol column of the reference cell (may be -1 to disable).
     */
    double[][] computeDistances(int srcRow, int srcCol, int heuristicRefRow, int heuristicRefCol) {
        int rows = map.rows;
        int cols = map.cols;

        CellNode[][] nodes = new CellNode[rows][cols];
        double[][] dist = new double[rows][cols];
        for (double[] row : dist) {
            java.util.Arrays.fill(row, Double.POSITIVE_INFINITY);
        }

        if (!map.inBounds(srcRow, srcCol) || map.isWall(srcRow, srcCol)) {
            return dist;
        }

        boolean useHeuristic = heuristicRefRow >= 0 && heuristicRefCol >= 0;

        BinaryHeap<CellNode> open = new BinaryHeap<>();

        CellNode source = new CellNode(srcRow, srcCol);
        nodes[srcRow][srcCol] = source;
        source.g = 0.0;
        open.add(source, (float) heuristic(srcRow, srcCol, heuristicRefRow, heuristicRefCol, useHeuristic));

        int[] dr = {-1, -1, -1, 0, 0, 1, 1, 1};
        int[] dc = {-1, 0, 1, -1, 1, -1, 0, 1};

        while (open.notEmpty()) {
            CellNode current = open.pop();
            if (current.closed) {
                continue;
            }
            current.closed = true;
            dist[current.row][current.col] = current.g;

            for (int dir = 0; dir < 8; dir++) {
                int nr = current.row + dr[dir];
                int nc = current.col + dc[dir];
                if (!map.inBounds(nr, nc) || map.isWall(nr, nc)) {
                    continue;
                }

                boolean diagonal = dr[dir] != 0 && dc[dir] != 0;
                if (diagonal) {
                    // No corner cutting: both orthogonal neighbors must be open.
                    if (map.isWall(current.row, nc) || map.isWall(nr, current.col)) {
                        continue;
                    }
                }

                double moveCost = edgeCost(current.row, current.col, nr, nc, diagonal);
                double candidateG = current.g + moveCost;

                CellNode neighbor = nodes[nr][nc];
                if (neighbor == null) {
                    neighbor = new CellNode(nr, nc);
                    nodes[nr][nc] = neighbor;
                }

                if (neighbor.closed) {
                    continue;
                }

                if (candidateG < neighbor.g) {
                    neighbor.g = candidateG;
                    double f = candidateG + heuristic(nr, nc, heuristicRefRow, heuristicRefCol, useHeuristic);
                    if (open.contains(neighbor, false)) {
                        open.setValue(neighbor, (float) f);
                    } else {
                        open.add(neighbor, (float) f);
                    }
                }
            }
        }

        return dist;
    }

    private double edgeCost(int r1, int c1, int r2, int c2, boolean diagonal) {
        double t1 = map.terrainCost(r1, c1);
        double t2 = map.terrainCost(r2, c2);
        double base = (t1 + t2) / 2.0;
        return diagonal ? SQRT2 * base : base;
    }

    private double heuristic(int r, int c, int refRow, int refCol, boolean enabled) {
        if (!enabled) {
            return 0.0;
        }
        int dr = Math.abs(r - refRow);
        int dc = Math.abs(c - refCol);
        int diag = Math.min(dr, dc);
        int straight = Math.abs(dr - dc);
        // Octile distance lower bound, scaled by the cheapest possible move costs.
        return diag * SQRT2 * MIN_TERRAIN_COST + straight * MIN_TERRAIN_COST;
    }
}
