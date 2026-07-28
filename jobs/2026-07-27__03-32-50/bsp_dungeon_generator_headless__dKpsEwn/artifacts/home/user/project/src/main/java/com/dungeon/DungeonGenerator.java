package com.dungeon;

import com.badlogic.gdx.math.RandomXS128;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Reads the input parameter file, runs the deterministic BSP dungeon
 * generation algorithm and writes {@code output.json} and {@code map.txt}
 * into the requested output directory.
 */
final class DungeonGenerator {

    private DungeonGenerator() {
    }

    static void run(String inputFilePath, String outputDirPath) throws IOException {
        Params params = readParams(inputFilePath);

        RandomXS128 rng = new RandomXS128(params.seed);

        List<int[]> leaves = new ArrayList<>();
        List<int[]> rooms = new ArrayList<>();
        List<int[]> corridors = new ArrayList<>();

        buildNode(rng, params.minLeaf, params.minRoom, params.maxDepth,
                0, 0, params.width, params.height, 0, leaves, rooms, corridors);

        char[][] grid = new char[params.height][params.width];
        for (char[] row : grid) {
            java.util.Arrays.fill(row, '#');
        }

        for (int[] room : rooms) {
            carveRect(grid, room[0], room[1], room[2], room[3]);
        }
        for (int[] seg : corridors) {
            carveSegment(grid, seg[0], seg[1], seg[2], seg[3]);
        }

        byte[] mapBytes = renderMap(grid, params.width, params.height);

        Path outDir = Paths.get(outputDirPath);
        Path mapPath = outDir.resolve("map.txt");
        Files.write(mapPath, mapBytes);

        long hash = fnv1a64(mapBytes);
        String mapHash = toHex16(hash);

        List<int[]> sortedRooms = new ArrayList<>(rooms);
        sortedRooms.sort(Comparator.<int[]>comparingInt(r -> r[1]).thenComparingInt(r -> r[0]));

        String json = buildJson(params, leaves, sortedRooms, corridors, mapHash);
        Path jsonPath = outDir.resolve("output.json");
        Files.write(jsonPath, json.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Recursively processes one BSP region. Returns the room rectangle
     * {@code [rx, ry, rw, rh]} that represents this node (its own room if it
     * is a leaf, or the representative of its first child if internal).
     */
    private static int[] buildNode(RandomXS128 rng, int minLeaf, int minRoom, int maxDepth,
                                    int x, int y, int w, int h, int depth,
                                    List<int[]> leaves, List<int[]> rooms, List<int[]> corridors) {
        boolean canSplitByWidth = w >= 2 * minLeaf;
        boolean canSplitByHeight = h >= 2 * minLeaf;
        boolean isInternal = depth < maxDepth && (canSplitByWidth || canSplitByHeight);

        if (!isInternal) {
            leaves.add(new int[]{x, y, w, h});

            int availW = w - 2;
            int availH = h - 2;
            int rw = minRoom + rng.nextInt(availW - minRoom + 1);
            int rh = minRoom + rng.nextInt(availH - minRoom + 1);
            int rx = (x + 1) + rng.nextInt(availW - rw + 1);
            int ry = (y + 1) + rng.nextInt(availH - rh + 1);

            int[] room = {rx, ry, rw, rh};
            rooms.add(room);
            return room;
        }

        boolean vertical;
        if (canSplitByWidth && !canSplitByHeight) {
            vertical = true;
        } else if (canSplitByHeight && !canSplitByWidth) {
            vertical = false;
        } else {
            int a = rng.nextInt(2);
            vertical = (a == 0);
        }

        int x1, y1, w1, h1, x2, y2, w2, h2;
        if (vertical) {
            int lw = minLeaf + rng.nextInt(w - 2 * minLeaf + 1);
            x1 = x;
            y1 = y;
            w1 = lw;
            h1 = h;
            x2 = x + lw;
            y2 = y;
            w2 = w - lw;
            h2 = h;
        } else {
            int th = minLeaf + rng.nextInt(h - 2 * minLeaf + 1);
            x1 = x;
            y1 = y;
            w1 = w;
            h1 = th;
            x2 = x;
            y2 = y + th;
            w2 = w;
            h2 = h - th;
        }

        // Reserve the two corridor-segment slots for this node now, so that
        // the final list order matches pre-order traversal order.
        int corridorIndex = corridors.size();
        corridors.add(null);
        corridors.add(null);

        int[] rep1 = buildNode(rng, minLeaf, minRoom, maxDepth, x1, y1, w1, h1, depth + 1, leaves, rooms, corridors);
        int[] rep2 = buildNode(rng, minLeaf, minRoom, maxDepth, x2, y2, w2, h2, depth + 1, leaves, rooms, corridors);

        int ax = rep1[0] + rep1[2] / 2;
        int ay = rep1[1] + rep1[3] / 2;
        int bx = rep2[0] + rep2[2] / 2;
        int by = rep2[1] + rep2[3] / 2;

        int[] horizontal = normalizeSegment(ax, ay, bx, ay);
        int[] vertical2 = normalizeSegment(bx, ay, bx, by);

        corridors.set(corridorIndex, horizontal);
        corridors.set(corridorIndex + 1, vertical2);

        return rep1;
    }

    private static int[] normalizeSegment(int x1, int y1, int x2, int y2) {
        int nx1 = Math.min(x1, x2);
        int nx2 = Math.max(x1, x2);
        int ny1 = Math.min(y1, y2);
        int ny2 = Math.max(y1, y2);
        return new int[]{nx1, ny1, nx2, ny2};
    }

    private static void carveRect(char[][] grid, int rx, int ry, int rw, int rh) {
        for (int y = ry; y < ry + rh; y++) {
            for (int x = rx; x < rx + rw; x++) {
                grid[y][x] = '.';
            }
        }
    }

    private static void carveSegment(char[][] grid, int x1, int y1, int x2, int y2) {
        for (int y = y1; y <= y2; y++) {
            for (int x = x1; x <= x2; x++) {
                grid[y][x] = '.';
            }
        }
    }

    private static byte[] renderMap(char[][] grid, int width, int height) {
        StringBuilder sb = new StringBuilder((width + 1) * height);
        for (int y = 0; y < height; y++) {
            sb.append(grid[y], 0, width);
            sb.append('\n');
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static long fnv1a64(byte[] data) {
        long hash = 0xcbf29ce484222325L;
        final long prime = 0x100000001b3L;
        for (byte b : data) {
            hash ^= (b & 0xffL);
            hash *= prime;
        }
        return hash;
    }

    private static String toHex16(long value) {
        String hex = Long.toHexString(value);
        StringBuilder sb = new StringBuilder(16);
        for (int i = hex.length(); i < 16; i++) {
            sb.append('0');
        }
        sb.append(hex);
        return sb.toString();
    }

    private static String buildJson(Params params, List<int[]> leaves, List<int[]> sortedRooms,
                                     List<int[]> corridors, String mapHash) {
        StringBuilder sb = new StringBuilder();
        sb.append('{');
        sb.append("\"seed\":").append(params.seed).append(',');
        sb.append("\"width\":").append(params.width).append(',');
        sb.append("\"height\":").append(params.height).append(',');
        sb.append("\"leaf_count\":").append(leaves.size()).append(',');
        sb.append("\"leaves\":");
        appendRectArray(sb, leaves);
        sb.append(',');
        sb.append("\"rooms\":");
        appendRectArray(sb, sortedRooms);
        sb.append(',');
        sb.append("\"corridors\":");
        appendRectArray(sb, corridors);
        sb.append(',');
        sb.append("\"map_hash\":\"").append(mapHash).append('"');
        sb.append('}');
        return sb.toString();
    }

    private static void appendRectArray(StringBuilder sb, List<int[]> items) {
        sb.append('[');
        for (int i = 0; i < items.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            int[] r = items.get(i);
            sb.append('[').append(r[0]).append(',').append(r[1]).append(',')
                    .append(r[2]).append(',').append(r[3]).append(']');
        }
        sb.append(']');
    }

    private static Params readParams(String inputFilePath) throws IOException {
        List<String> lines = Files.readAllLines(Paths.get(inputFilePath), StandardCharsets.UTF_8);

        Params params = new Params();
        params.seed = parseKeyValue(lines, 0, "seed", Long::parseLong);
        params.width = parseKeyValue(lines, 1, "width", Integer::parseInt);
        params.height = parseKeyValue(lines, 2, "height", Integer::parseInt);
        params.minLeaf = parseKeyValue(lines, 3, "min_leaf", Integer::parseInt);
        params.minRoom = parseKeyValue(lines, 4, "min_room", Integer::parseInt);
        params.maxDepth = parseKeyValue(lines, 5, "max_depth", Integer::parseInt);
        return params;
    }

    private interface Parser<T> {
        T parse(String s);
    }

    private static <T> T parseKeyValue(List<String> lines, int index, String expectedKey, Parser<T> parser) {
        if (index >= lines.size()) {
            throw new IllegalArgumentException("Missing line for key '" + expectedKey + "'");
        }
        String line = lines.get(index);
        int sp = line.indexOf(' ');
        if (sp < 0) {
            throw new IllegalArgumentException("Malformed line: '" + line + "'");
        }
        String key = line.substring(0, sp);
        String value = line.substring(sp + 1);
        if (!key.equals(expectedKey)) {
            throw new IllegalArgumentException("Expected key '" + expectedKey + "' but got '" + key + "'");
        }
        return parser.parse(value.trim());
    }

    private static final class Params {
        long seed;
        int width;
        int height;
        int minLeaf;
        int minRoom;
        int maxDepth;
    }
}
