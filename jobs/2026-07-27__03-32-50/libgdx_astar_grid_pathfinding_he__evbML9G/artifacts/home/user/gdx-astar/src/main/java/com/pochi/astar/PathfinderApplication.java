package com.pochi.astar;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Drives the whole pathfinding computation from within the libGDX headless
 * application lifecycle. All work happens in {@link #create()}; no
 * rendering, graphics, or audio APIs are touched.
 */
final class PathfinderApplication implements ApplicationListener {

    private static final double EPS = 1e-9;
    private static final double SQRT2 = Math.sqrt(2.0);

    private final String mapFilePath;

    PathfinderApplication(String mapFilePath) {
        this.mapFilePath = mapFilePath;
    }

    @Override
    public void create() {
        try {
            run();
        } catch (IOException e) {
            System.err.println("Failed to read map file: " + e.getMessage());
        } finally {
            Gdx.app.exit();
        }
    }

    private void run() throws IOException {
        GridMap map = GridMap.load(mapFilePath);

        // Full-grid shortest distance to the goal, computed once via a
        // BinaryHeap-backed weighted A* search rooted at the goal cell (the
        // movement/cost model is symmetric, so distance-to-goal equals
        // distance-from-goal). This lets us later greedily rebuild the
        // lexicographically smallest optimal path without a second search.
        AStarSearch search = new AStarSearch(map);
        double[][] distToGoal = search.computeDistances(map.goalRow, map.goalCol, map.startRow, map.startCol);

        double totalCost = distToGoal[map.startRow][map.startCol];
        if (Double.isInfinite(totalCost)) {
            System.out.println("NO PATH");
            return;
        }

        List<int[]> path = reconstructPath(map, distToGoal, totalCost);

        StringBuilder sb = new StringBuilder();
        sb.append("LENGTH ").append(path.size()).append('\n');
        sb.append("COST ").append(formatCost(totalCost)).append('\n');
        sb.append("PATH").append('\n');
        for (int[] cell : path) {
            sb.append(cell[0]).append(',').append(cell[1]).append('\n');
        }
        System.out.print(sb);
    }

    /**
     * Greedily walks from start to goal. At every step, among all neighbors
     * that continue some minimum-cost path (verified via the precomputed
     * distance-to-goal array), the lexicographically smallest cell (row
     * first, then column) is chosen. Since all edge costs are strictly
     * positive, minimum-cost paths are simple, and picking the smallest
     * viable next cell at each step yields the overall lexicographically
     * smallest optimal path.
     */
    private List<int[]> reconstructPath(GridMap map, double[][] distToGoal, double totalCost) {
        List<int[]> path = new ArrayList<>();
        int r = map.startRow;
        int c = map.startCol;
        path.add(new int[] {r, c});

        int[] dr = {-1, -1, -1, 0, 0, 1, 1, 1};
        int[] dc = {-1, 0, 1, -1, 1, -1, 0, 1};

        while (r != map.goalRow || c != map.goalCol) {
            double remaining = distToGoal[r][c];

            int bestR = -1;
            int bestC = -1;

            for (int dir = 0; dir < 8; dir++) {
                int nr = r + dr[dir];
                int nc = c + dc[dir];
                if (!map.inBounds(nr, nc) || map.isWall(nr, nc)) {
                    continue;
                }

                boolean diagonal = dr[dir] != 0 && dc[dir] != 0;
                if (diagonal) {
                    if (map.isWall(r, nc) || map.isWall(nr, c)) {
                        continue;
                    }
                }

                double h = distToGoal[nr][nc];
                if (Double.isInfinite(h)) {
                    continue;
                }

                double t1 = map.terrainCost(r, c);
                double t2 = map.terrainCost(nr, nc);
                double base = (t1 + t2) / 2.0;
                double moveCost = diagonal ? SQRT2 * base : base;

                if (Math.abs(moveCost + h - remaining) <= EPS) {
                    if (bestR == -1 || nr < bestR || (nr == bestR && nc < bestC)) {
                        bestR = nr;
                        bestC = nc;
                    }
                }
            }

            if (bestR == -1) {
                // Should be unreachable given totalCost was finite, but guard
                // defensively against floating point edge cases.
                throw new IllegalStateException("Failed to reconstruct optimal path");
            }

            r = bestR;
            c = bestC;
            path.add(new int[] {r, c});
        }

        return path;
    }

    private static String formatCost(double cost) {
        BigDecimal bd = BigDecimal.valueOf(cost).setScale(4, RoundingMode.HALF_UP);
        return bd.toPlainString();
    }

    @Override
    public void resize(int width, int height) {
    }

    @Override
    public void render() {
    }

    @Override
    public void pause() {
    }

    @Override
    public void resume() {
    }

    @Override
    public void dispose() {
    }
}
