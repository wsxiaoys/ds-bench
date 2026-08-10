package com.quadtree.headless;

import com.badlogicgames.gdx.ApplicationListener;
import com.badlogicgames.gdx.Gdx;
import com.badlogicgames.gdx.backends.headless.HeadlessApplication;
import com.badlogicgames.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogicgames.gdx.math.Rectangle;
import com.badlogicgames.gdx.utils.Array;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.StringTokenizer;

public class HeadlessLauncher {

    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: HeadlessLauncher <inputPath> <outputPath>");
            System.exit(1);
        }
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        new HeadlessApplication(new CollisionSimulator(args[0], args[1]), config);
    }

    public static class Entity {
        public int id;
        public int cx, cy;
        public int hx, hy;
        public int vx, vy;

        public int boxMinX, boxMaxX, boxMinY, boxMaxY;
        public Rectangle rect;

        public Entity(int id, int cx, int cy, int hx, int hy, int vx, int vy) {
            this.id = id;
            this.cx = cx;
            this.cy = cy;
            this.hx = hx;
            this.hy = hy;
            this.vx = vx;
            this.vy = vy;
            this.rect = new Rectangle();
            updateBounds();
        }

        public void tick() {
            cx += vx;
            cy += vy;
            updateBounds();
        }

        private void updateBounds() {
            boxMinX = cx - hx;
            boxMaxX = cx + hx;
            boxMinY = cy - hy;
            boxMaxY = cy + hy;
            rect.set(boxMinX, boxMinY, 2 * hx, 2 * hy);
        }
    }

    public static class QuadNode {
        public int minX, maxX, minY, maxY;
        public int depth;
        public Array<Entity> entities;
        public QuadNode nw, ne, sw, se;
        public boolean isLeaf;

        public QuadNode(int minX, int maxX, int minY, int maxY, int depth) {
            this.minX = minX;
            this.maxX = maxX;
            this.minY = minY;
            this.maxY = maxY;
            this.depth = depth;
            this.entities = new Array<>();
            this.isLeaf = true;
        }

        public boolean fullyContains(Entity entity) {
            return entity.boxMinX >= minX && entity.boxMaxX <= maxX &&
                   entity.boxMinY >= minY && entity.boxMaxY <= maxY;
        }

        public void insert(Entity entity) {
            if (!isLeaf) {
                QuadNode child = findContainingChild(entity);
                if (child != null) {
                    child.insert(entity);
                } else {
                    entities.add(entity);
                }
            } else {
                entities.add(entity);
                if (entities.size > 3 && depth < 6) { // C = 3, MAX_DEPTH = 6
                    subdivide();
                }
            }
        }

        private QuadNode findContainingChild(Entity entity) {
            if (nw.fullyContains(entity)) return nw;
            if (ne.fullyContains(entity)) return ne;
            if (sw.fullyContains(entity)) return sw;
            if (se.fullyContains(entity)) return se;
            return null;
        }

        public void subdivide() {
            int midX = (minX + maxX) / 2;
            int midY = (minY + maxY) / 2;

            nw = new QuadNode(minX, midX, midY, maxY, depth + 1);
            ne = new QuadNode(midX, maxX, midY, maxY, depth + 1);
            sw = new QuadNode(minX, midX, minY, midY, depth + 1);
            se = new QuadNode(midX, maxX, minY, midY, depth + 1);

            isLeaf = false;

            Array<Entity> temp = new Array<>(entities);
            entities.clear();

            for (int i = 0; i < temp.size; i++) {
                Entity e = temp.get(i);
                QuadNode child = findContainingChild(e);
                if (child != null) {
                    child.insert(e);
                } else {
                    entities.add(e);
                }
            }
        }

        public void buildSignature(StringBuilder sb) {
            if (sb.length() > 0) {
                sb.append(" ");
            }
            if (isLeaf) {
                sb.append("L").append(entities.size);
            } else {
                sb.append("N").append(entities.size);
                nw.buildSignature(sb);
                ne.buildSignature(sb);
                sw.buildSignature(sb);
                se.buildSignature(sb);
            }
        }
    }

    public static class Pair implements Comparable<Pair> {
        public int idA;
        public int idB;

        public Pair(int idA, int idB) {
            if (idA < idB) {
                this.idA = idA;
                this.idB = idB;
            } else {
                this.idA = idB;
                this.idB = idA;
            }
        }

        @Override
        public int compareTo(Pair other) {
            if (this.idA != other.idA) {
                return Integer.compare(this.idA, other.idA);
            }
            return Integer.compare(this.idB, other.idB);
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Pair)) return false;
            Pair pair = (Pair) o;
            return idA == pair.idA && idB == pair.idB;
        }

        @Override
        public int hashCode() {
            return 31 * idA + idB;
        }
    }

    public static class FastScanner {
        private BufferedReader br;
        private StringTokenizer st;

        public FastScanner(String path) throws IOException {
            br = new BufferedReader(new FileReader(path));
        }

        public String next() throws IOException {
            while (st == null || !st.hasMoreTokens()) {
                String line = br.readLine();
                if (line == null) {
                    return null;
                }
                st = new StringTokenizer(line);
            }
            return st.nextToken();
        }

        public int nextInt() throws IOException {
            String s = next();
            if (s == null) {
                throw new IOException("Unexpected end of file");
            }
            return Integer.parseInt(s);
        }

        public void close() throws IOException {
            br.close();
        }
    }

    public static class CollisionSimulator implements ApplicationListener {
        private final String inputPath;
        private final String outputPath;

        public CollisionSimulator(String inputPath, String outputPath) {
            this.inputPath = inputPath;
            this.outputPath = outputPath;
        }

        @Override
        public void create() {
            try {
                runSimulation();
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                Gdx.app.exit();
            }
        }

        private void runSimulation() throws IOException {
            FastScanner scanner = new FastScanner(inputPath);
            int numEntities = scanner.nextInt();
            int numTicks = scanner.nextInt();

            Entity[] entities = new Entity[numEntities];
            for (int i = 0; i < numEntities; i++) {
                int id = scanner.nextInt();
                int cx = scanner.nextInt();
                int cy = scanner.nextInt();
                int hx = scanner.nextInt();
                int hy = scanner.nextInt();
                int vx = scanner.nextInt();
                int vy = scanner.nextInt();
                entities[i] = new Entity(id, cx, cy, hx, hy, vx, vy);
            }
            scanner.close();

            PrintWriter writer = new PrintWriter(new BufferedWriter(new FileWriter(outputPath)));

            for (int t = 1; t <= numTicks; t++) {
                // 1. Advance every entity
                for (Entity e : entities) {
                    e.tick();
                }

                // 2. Build the tree fresh
                QuadNode root = new QuadNode(0, 1024, 0, 1024, 0);
                for (Entity e : entities) {
                    root.insert(e);
                }

                // 3. Find candidate pairs and narrowphase overlaps
                List<Pair> overlappingPairs = new ArrayList<>();
                int[] K = new int[1];
                Array<Entity> ancestorList = new Array<>();
                findPairs(root, ancestorList, overlappingPairs, K);

                // 4. Sort overlapping pairs
                Collections.sort(overlappingPairs);

                // 5. Generate tree signature
                StringBuilder sigBuilder = new StringBuilder();
                root.buildSignature(sigBuilder);

                // 6. Write to output
                writer.println("TICK " + t);
                writer.println("CANDIDATES " + K[0]);
                writer.println("TREE " + sigBuilder.toString());
                for (Pair p : overlappingPairs) {
                    writer.println(p.idA + "," + p.idB);
                }
                writer.println(); // Blank line after block
            }

            writer.flush();
            writer.close();
        }

        private void findPairs(QuadNode node, Array<Entity> ancestorList, List<Pair> overlappingPairs, int[] K) {
            // Pair entities stored directly in this node with each other
            for (int i = 0; i < node.entities.size; i++) {
                Entity a = node.entities.get(i);
                for (int j = i + 1; j < node.entities.size; j++) {
                    Entity b = node.entities.get(j);
                    K[0]++;
                    if (checkOverlap(a, b)) {
                        overlappingPairs.add(new Pair(a.id, b.id));
                    }
                }
            }

            // Pair entities stored directly in this node with entities in ancestorList
            for (int i = 0; i < node.entities.size; i++) {
                Entity a = node.entities.get(i);
                for (int j = 0; j < ancestorList.size; j++) {
                    Entity b = ancestorList.get(j);
                    K[0]++;
                    if (checkOverlap(a, b)) {
                        overlappingPairs.add(new Pair(a.id, b.id));
                    }
                }
            }

            // Recurse NW, NE, SW, SE
            if (!node.isLeaf) {
                // Push current node's entities to ancestorList
                for (int i = 0; i < node.entities.size; i++) {
                    ancestorList.add(node.entities.get(i));
                }

                findPairs(node.nw, ancestorList, overlappingPairs, K);
                findPairs(node.ne, ancestorList, overlappingPairs, K);
                findPairs(node.sw, ancestorList, overlappingPairs, K);
                findPairs(node.se, ancestorList, overlappingPairs, K);

                // Pop current node's entities from ancestorList
                for (int i = 0; i < node.entities.size; i++) {
                    ancestorList.removeIndex(ancestorList.size - 1);
                }
            }
        }

        private boolean checkOverlap(Entity a, Entity b) {
            return a.boxMinX < b.boxMaxX && a.boxMaxX > b.boxMinX &&
                   a.boxMinY < b.boxMaxY && a.boxMaxY > b.boxMinY;
        }

        @Override public void resize(int width, int height) {}
        @Override public void render() {}
        @Override public void pause() {}
        @Override public void resume() {}
        @Override public void dispose() {}
    }
}
