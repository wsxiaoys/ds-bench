package com.dungeon;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.math.RandomXS128;
import com.badlogic.gdx.Gdx;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

public class DungeonGeneratorApp implements ApplicationListener {

    public static class Node {
        public int x, y, w, h;
        public int depth;
        public boolean isLeaf;
        public Node left;
        public Node right;

        // For leaf:
        public int rx, ry, rw, rh;

        public Room getRepresentativeRoom() {
            if (isLeaf) {
                return new Room(rx, ry, rw, rh);
            } else {
                return left.getRepresentativeRoom();
            }
        }
    }

    public static class Room {
        public int x, y, w, h;

        public Room(int x, int y, int w, int h) {
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
        }
    }

    public static class Corridor {
        public int x1, y1, x2, y2;

        public Corridor(int x1, int y1, int x2, int y2) {
            this.x1 = Math.min(x1, x2);
            this.y1 = Math.min(y1, y2);
            this.x2 = Math.max(x1, x2);
            this.y2 = Math.max(y1, y2);
        }
    }

    private final String inputFile;
    private final String outputDir;

    public DungeonGeneratorApp(String inputFile, String outputDir) {
        this.inputFile = inputFile;
        this.outputDir = outputDir;
    }

    @Override
    public void create() {
        try {
            generateDungeon(inputFile, outputDir);
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        } finally {
            Gdx.app.exit();
        }
    }

    @Override
    public void resize(int width, int height) {}

    @Override
    public void render() {}

    @Override
    public void pause() {}

    @Override
    public void resume() {}

    @Override
    public void dispose() {}

    public void generateDungeon(String inputFile, String outputDir) throws IOException {
        // Read input file
        long seed = 0;
        int width = 0;
        int height = 0;
        int min_leaf = 0;
        int min_room = 0;
        int max_depth = 0;

        List<String> lines = Files.readAllLines(Paths.get(inputFile), StandardCharsets.UTF_8);
        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty()) continue;
            String[] parts = line.split("\\s+");
            if (parts.length < 2) continue;
            String key = parts[0];
            String val = parts[1];
            if (key.equals("seed")) seed = Long.parseLong(val);
            else if (key.equals("width")) width = Integer.parseInt(val);
            else if (key.equals("height")) height = Integer.parseInt(val);
            else if (key.equals("min_leaf")) min_leaf = Integer.parseInt(val);
            else if (key.equals("min_room")) min_room = Integer.parseInt(val);
            else if (key.equals("max_depth")) max_depth = Integer.parseInt(val);
        }

        // Create RandomXS128
        RandomXS128 rng = new RandomXS128(seed);

        // Build BSP tree
        Node root = buildTree(0, 0, width, height, 0, rng, min_leaf, min_room, max_depth);

        // Collect leaves, rooms, corridors
        List<Node> leaves = new ArrayList<>();
        List<Room> rooms = new ArrayList<>();
        List<Corridor> corridors = new ArrayList<>();
        collectData(root, leaves, rooms, corridors);

        // Sort rooms ascending by y, then by x
        rooms.sort((r1, r2) -> {
            if (r1.y != r2.y) {
                return Integer.compare(r1.y, r2.y);
            }
            return Integer.compare(r1.x, r2.x);
        });

        // Initialize grid with walls '#'
        char[][] grid = new char[height][width];
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                grid[y][x] = '#';
            }
        }

        // Carve rooms
        for (Room room : rooms) {
            for (int y = room.y; y < room.y + room.h; y++) {
                for (int x = room.x; x < room.x + room.w; x++) {
                    grid[y][x] = '.';
                }
            }
        }

        // Carve corridors
        for (Corridor corr : corridors) {
            if (corr.y1 == corr.y2) {
                // Horizontal
                for (int x = corr.x1; x <= corr.x2; x++) {
                    grid[corr.y1][x] = '.';
                }
            } else if (corr.x1 == corr.x2) {
                // Vertical
                for (int y = corr.y1; y <= corr.y2; y++) {
                    grid[y][corr.x1] = '.';
                }
            } else {
                for (int y = corr.y1; y <= corr.y2; y++) {
                    for (int x = corr.x1; x <= corr.x2; x++) {
                        grid[y][x] = '.';
                    }
                }
            }
        }

        // Build map.txt string
        StringBuilder mapBuilder = new StringBuilder();
        for (int y = 0; y < height; y++) {
            mapBuilder.append(grid[y]);
            mapBuilder.append('\n');
        }
        String mapText = mapBuilder.toString();
        byte[] mapBytes = mapText.getBytes(StandardCharsets.UTF_8);

        // Calculate FNV-1a hash
        String mapHash = calculateFNV1a(mapBytes);

        // Write map.txt
        Files.write(Paths.get(outputDir, "map.txt"), mapBytes);

        // Write output.json
        StringBuilder json = new StringBuilder();
        json.append("{\n");
        json.append("  \"seed\": ").append(seed).append(",\n");
        json.append("  \"width\": ").append(width).append(",\n");
        json.append("  \"height\": ").append(height).append(",\n");
        json.append("  \"leaf_count\": ").append(leaves.size()).append(",\n");

        json.append("  \"leaves\": [\n");
        for (int i = 0; i < leaves.size(); i++) {
            Node leaf = leaves.get(i);
            json.append("    [").append(leaf.x).append(",").append(leaf.y).append(",").append(leaf.w).append(",").append(leaf.h).append("]");
            if (i < leaves.size() - 1) {
                json.append(",\n");
            } else {
                json.append("\n");
            }
        }
        json.append("  ],\n");

        json.append("  \"rooms\": [\n");
        for (int i = 0; i < rooms.size(); i++) {
            Room room = rooms.get(i);
            json.append("    [").append(room.x).append(",").append(room.y).append(",").append(room.w).append(",").append(room.h).append("]");
            if (i < rooms.size() - 1) {
                json.append(",\n");
            } else {
                json.append("\n");
            }
        }
        json.append("  ],\n");

        json.append("  \"corridors\": [\n");
        for (int i = 0; i < corridors.size(); i++) {
            Corridor corr = corridors.get(i);
            json.append("    [").append(corr.x1).append(",").append(corr.y1).append(",").append(corr.x2).append(",").append(corr.y2).append("]");
            if (i < corridors.size() - 1) {
                json.append(",\n");
            } else {
                json.append("\n");
            }
        }
        json.append("  ],\n");

        json.append("  \"map_hash\": \"").append(mapHash).append("\"\n");
        json.append("}\n");

        Files.write(Paths.get(outputDir, "output.json"), json.toString().getBytes(StandardCharsets.UTF_8));
    }

    private Node buildTree(int x, int y, int w, int h, int depth, RandomXS128 rng, int min_leaf, int min_room, int max_depth) {
        Node node = new Node();
        node.x = x;
        node.y = y;
        node.w = w;
        node.h = h;
        node.depth = depth;

        boolean canSplit = (depth < max_depth) && (w >= 2 * min_leaf || h >= 2 * min_leaf);

        if (canSplit) {
            node.isLeaf = false;
            boolean splitVertical;
            if (w >= 2 * min_leaf && h < 2 * min_leaf) {
                splitVertical = true;
            } else if (h >= 2 * min_leaf && w < 2 * min_leaf) {
                splitVertical = false;
            } else {
                int a = rng.nextInt(2);
                splitVertical = (a == 0);
            }

            if (splitVertical) {
                int lw = min_leaf + rng.nextInt(w - 2 * min_leaf + 1);
                node.left = buildTree(x, y, lw, h, depth + 1, rng, min_leaf, min_room, max_depth);
                node.right = buildTree(x + lw, y, w - lw, h, depth + 1, rng, min_leaf, min_room, max_depth);
            } else {
                int th = min_leaf + rng.nextInt(h - 2 * min_leaf + 1);
                node.left = buildTree(x, y, w, th, depth + 1, rng, min_leaf, min_room, max_depth);
                node.right = buildTree(x, y + th, w, h - th, depth + 1, rng, min_leaf, min_room, max_depth);
            }
        } else {
            node.isLeaf = true;
            int availW = w - 2;
            int availH = h - 2;
            node.rw = min_room + rng.nextInt(availW - min_room + 1);
            node.rh = min_room + rng.nextInt(availH - min_room + 1);
            node.rx = (x + 1) + rng.nextInt(availW - node.rw + 1);
            node.ry = (y + 1) + rng.nextInt(availH - node.rh + 1);
        }
        return node;
    }

    private void collectData(Node node, List<Node> leaves, List<Room> rooms, List<Corridor> corridors) {
        if (node.isLeaf) {
            leaves.add(node);
            rooms.add(new Room(node.rx, node.ry, node.rw, node.rh));
        } else {
            Room r1 = node.left.getRepresentativeRoom();
            Room r2 = node.right.getRepresentativeRoom();

            int ax = r1.x + r1.w / 2;
            int ay = r1.y + r1.h / 2;
            int bx = r2.x + r2.w / 2;
            int by = r2.y + r2.h / 2;

            corridors.add(new Corridor(ax, ay, bx, ay));
            corridors.add(new Corridor(bx, ay, bx, by));

            collectData(node.left, leaves, rooms, corridors);
            collectData(node.right, leaves, rooms, corridors);
        }
    }

    public static String calculateFNV1a(byte[] data) {
        long hash = 0xcbf29ce484222325L;
        long prime = 0x100000001b3L;
        for (byte b : data) {
            hash ^= (b & 0xff);
            hash *= prime;
        }
        return String.format("%016x", hash);
    }

    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: DungeonGeneratorApp <input_file> <output_dir>");
            System.exit(1);
        }
        String inputFile = args[0];
        String outputDir = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        new HeadlessApplication(new DungeonGeneratorApp(inputFile, outputDir), config);
    }
}
