package com.pochi.astar;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.FileReader;
import java.util.ArrayList;
import java.util.List;

/**
 * Parses and represents a weighted grid map, as described in the task's
 * "Input file format" section.
 */
public final class GridMap {

    public final int rows;
    public final int cols;
    public final int startRow;
    public final int startCol;
    public final int goalRow;
    public final int goalCol;

    /** true if the cell is a wall ('#'). */
    private final boolean[][] wall;
    /** terrain cost (1-9) for open cells; undefined (0) for walls. */
    private final int[][] cost;

    private GridMap(int rows, int cols, int startRow, int startCol, int goalRow, int goalCol,
                     boolean[][] wall, int[][] cost) {
        this.rows = rows;
        this.cols = cols;
        this.startRow = startRow;
        this.startCol = startCol;
        this.goalRow = goalRow;
        this.goalCol = goalCol;
        this.wall = wall;
        this.cost = cost;
    }

    public static GridMap load(String path) throws IOException {
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new FileReader(path))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lines.add(line);
            }
        }

        int idx = 0;
        String[] dims = splitInts(lines.get(idx++));
        int rows = Integer.parseInt(dims[0]);
        int cols = Integer.parseInt(dims[1]);

        String[] startTok = splitInts(lines.get(idx++));
        int startRow = Integer.parseInt(startTok[0]);
        int startCol = Integer.parseInt(startTok[1]);

        String[] goalTok = splitInts(lines.get(idx++));
        int goalRow = Integer.parseInt(goalTok[0]);
        int goalCol = Integer.parseInt(goalTok[1]);

        boolean[][] wall = new boolean[rows][cols];
        int[][] cost = new int[rows][cols];

        for (int r = 0; r < rows; r++) {
            String rowLine = idx < lines.size() ? lines.get(idx++) : "";
            // Guard against trailing carriage returns from CRLF files.
            rowLine = stripTrailingCr(rowLine);
            for (int c = 0; c < cols; c++) {
                char ch = c < rowLine.length() ? rowLine.charAt(c) : '#';
                if (ch == '#') {
                    wall[r][c] = true;
                } else {
                    wall[r][c] = false;
                    cost[r][c] = ch - '0';
                }
            }
        }

        return new GridMap(rows, cols, startRow, startCol, goalRow, goalCol, wall, cost);
    }

    private static String stripTrailingCr(String s) {
        if (!s.isEmpty() && s.charAt(s.length() - 1) == '\r') {
            return s.substring(0, s.length() - 1);
        }
        return s;
    }

    private static String[] splitInts(String line) {
        return line.trim().split("\\s+");
    }

    public boolean inBounds(int r, int c) {
        return r >= 0 && r < rows && c >= 0 && c < cols;
    }

    public boolean isWall(int r, int c) {
        return wall[r][c];
    }

    public int terrainCost(int r, int c) {
        return cost[r][c];
    }
}
