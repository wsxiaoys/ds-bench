package com.example;

import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.utils.Array;
import com.badlogic.gdx.utils.IntArray;
import com.badlogic.gdx.utils.IntMap;
import com.badlogic.gdx.utils.LongArray;
import com.badlogic.gdx.utils.LongMap;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.Locale;

/**
 * Deterministic 2D circle-collision simulation using a uniform spatial hash
 * for broad-phase candidate pair generation.
 */
public final class Simulation {

    private Simulation() {
    }

    public static void run(String inputPath, String outputPath) throws IOException {
        String text = new String(Files.readAllBytes(Paths.get(inputPath)), StandardCharsets.UTF_8);
        String[] tokens = text.trim().isEmpty() ? new String[0] : text.trim().split("\\s+");
        Tok tok = new Tok(tokens);

        float W = tok.nextFloat();
        float H = tok.nextFloat();
        float C = tok.nextFloat();
        float DT = tok.nextFloat();
        int T = tok.nextInt();
        float E = tok.nextFloat();
        int K = tok.nextInt();
        int[] checkpoints = new int[K];
        for (int i = 0; i < K; i++) {
            checkpoints[i] = tok.nextInt();
        }
        int N = tok.nextInt();

        Array<CircleBody> circles = new Array<>(true, Math.max(N, 1));
        IntMap<CircleBody> idToCircle = new IntMap<>(Math.max(N, 1));
        for (int i = 0; i < N; i++) {
            int id = tok.nextInt();
            float x = tok.nextFloat();
            float y = tok.nextFloat();
            float vx = tok.nextFloat();
            float vy = tok.nextFloat();
            float r = tok.nextFloat();
            CircleBody c = new CircleBody();
            c.id = id;
            c.pos.set(x, y);
            c.vel.set(vx, vy);
            c.r = r;
            circles.add(c);
            idToCircle.put(id, c);
        }

        // Canonical output order: ascending by id. The array order never
        // changes afterwards, only the circle contents mutate in place.
        circles.sort(new Comparator<CircleBody>() {
            @Override
            public int compare(CircleBody a, CircleBody b) {
                return Integer.compare(a.id, b.id);
            }
        });

        int n = circles.size;

        LongMap<IntArray> cellMap = new LongMap<>();
        LongMap<Boolean> seenPairs = new LongMap<>();
        LongArray collisionKeys = new LongArray();

        int checkpointCursor = 0;

        try (BufferedWriter writer = Files.newBufferedWriter(Paths.get(outputPath), StandardCharsets.UTF_8)) {
            for (int tick = 1; tick <= T; tick++) {
                // 1. Integrate.
                for (int i = 0; i < n; i++) {
                    CircleBody c = circles.get(i);
                    c.pos.x += c.vel.x * DT;
                    c.pos.y += c.vel.y * DT;
                }

                // 2. Walls (x-axis then y-axis).
                for (int i = 0; i < n; i++) {
                    CircleBody c = circles.get(i);
                    resolveWalls(c, W, H, E);
                }

                // 3. Rebuild the spatial hash from current positions.
                cellMap.clear();
                for (int i = 0; i < n; i++) {
                    CircleBody c = circles.get(i);
                    float minX = c.pos.x - c.r;
                    float maxX = c.pos.x + c.r;
                    float minY = c.pos.y - c.r;
                    float maxY = c.pos.y + c.r;
                    int cx0 = MathUtils.floor(minX / C);
                    int cx1 = MathUtils.floor(maxX / C);
                    int cy0 = MathUtils.floor(minY / C);
                    int cy1 = MathUtils.floor(maxY / C);
                    for (int cx = cx0; cx <= cx1; cx++) {
                        for (int cy = cy0; cy <= cy1; cy++) {
                            long key = packCell(cx, cy);
                            IntArray list = cellMap.get(key);
                            if (list == null) {
                                list = new IntArray();
                                cellMap.put(key, list);
                            }
                            list.add(i);
                        }
                    }
                }

                // 4. Broad phase + narrow phase (detection on a frozen snapshot).
                seenPairs.clear();
                collisionKeys.clear();
                long checks = 0;

                for (LongMap.Entry<IntArray> entry : cellMap.entries()) {
                    IntArray list = entry.value;
                    int size = list.size;
                    for (int a = 0; a < size; a++) {
                        int ia = list.get(a);
                        for (int b = a + 1; b < size; b++) {
                            int ib = list.get(b);
                            int lo = Math.min(ia, ib);
                            int hi = Math.max(ia, ib);
                            long pairKey = packPair(lo, hi);
                            if (seenPairs.containsKey(pairKey)) {
                                continue;
                            }
                            seenPairs.put(pairKey, Boolean.TRUE);
                            checks++;

                            CircleBody ca = circles.get(lo);
                            CircleBody cb = circles.get(hi);
                            float dx = cb.pos.x - ca.pos.x;
                            float dy = cb.pos.y - ca.pos.y;
                            float dist = (float) Math.sqrt(dx * dx + dy * dy);
                            if (dist < ca.r + cb.r) {
                                int idLo = Math.min(ca.id, cb.id);
                                int idHi = Math.max(ca.id, cb.id);
                                collisionKeys.add(packPair(idLo, idHi));
                            }
                        }
                    }
                }

                collisionKeys.sort();

                // 5. Resolution, in ascending (min id, max id) order.
                for (int k = 0; k < collisionKeys.size; k++) {
                    long key = collisionKeys.get(k);
                    int idLo = (int) (key >>> 32);
                    int idHi = (int) (key & 0xffffffffL);
                    CircleBody a = idToCircle.get(idLo);
                    CircleBody b = idToCircle.get(idHi);
                    resolveCollision(a, b, E);
                }

                // Emit checkpoint output if this tick is one of the requested ticks.
                if (checkpointCursor < K && checkpoints[checkpointCursor] == tick) {
                    checkpointCursor++;
                    writeCheckpoint(writer, tick, checks, collisionKeys, circles);
                }
            }
        }
    }

    private static void resolveWalls(CircleBody c, float W, float H, float E) {
        if (c.pos.x - c.r < 0) {
            c.pos.x = c.r;
            if (c.vel.x < 0) {
                c.vel.x = -c.vel.x * E;
            }
        }
        if (c.pos.x + c.r > W) {
            c.pos.x = W - c.r;
            if (c.vel.x > 0) {
                c.vel.x = -c.vel.x * E;
            }
        }
        if (c.pos.y - c.r < 0) {
            c.pos.y = c.r;
            if (c.vel.y < 0) {
                c.vel.y = -c.vel.y * E;
            }
        }
        if (c.pos.y + c.r > H) {
            c.pos.y = H - c.r;
            if (c.vel.y > 0) {
                c.vel.y = -c.vel.y * E;
            }
        }
    }

    private static void resolveCollision(CircleBody a, CircleBody b, float E) {
        float dx = b.pos.x - a.pos.x;
        float dy = b.pos.y - a.pos.y;
        float d = (float) Math.sqrt(dx * dx + dy * dy);

        float nx, ny, overlap;
        if (d == 0f) {
            nx = 1f;
            ny = 0f;
            overlap = a.r + b.r;
        } else {
            nx = dx / d;
            ny = dy / d;
            overlap = (a.r + b.r) - d;
        }

        float half = overlap / 2f;
        a.pos.x -= half * nx;
        a.pos.y -= half * ny;
        b.pos.x += half * nx;
        b.pos.y += half * ny;

        float vn = (a.vel.x - b.vel.x) * nx + (a.vel.y - b.vel.y) * ny;
        if (vn > 0) {
            float ma = a.r * a.r;
            float mb = b.r * b.r;
            float j = (1f + E) * vn / (1f / ma + 1f / mb);
            a.vel.x -= (j / ma) * nx;
            a.vel.y -= (j / ma) * ny;
            b.vel.x += (j / mb) * nx;
            b.vel.y += (j / mb) * ny;
        }
    }

    private static void writeCheckpoint(BufferedWriter writer, int tick, long checks,
                                         LongArray collisionKeys, Array<CircleBody> circles) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append("TICK ").append(tick).append('\n');
        sb.append("CHECKS ").append(checks).append('\n');
        sb.append("COLLISIONS ").append(collisionKeys.size).append('\n');
        for (int k = 0; k < collisionKeys.size; k++) {
            long key = collisionKeys.get(k);
            int idLo = (int) (key >>> 32);
            int idHi = (int) (key & 0xffffffffL);
            sb.append(idLo).append(' ').append(idHi).append('\n');
        }
        sb.append("CIRCLES ").append(circles.size).append('\n');
        for (int i = 0; i < circles.size; i++) {
            CircleBody c = circles.get(i);
            sb.append(c.id).append(' ')
                    .append(fmt(c.pos.x)).append(' ')
                    .append(fmt(c.pos.y)).append(' ')
                    .append(fmt(c.vel.x)).append(' ')
                    .append(fmt(c.vel.y)).append('\n');
        }
        writer.write(sb.toString());
    }

    private static String fmt(float v) {
        return String.format(Locale.US, "%.5f", v);
    }

    private static long packCell(int cx, int cy) {
        return ((long) cx << 32) | (cy & 0xffffffffL);
    }

    private static long packPair(int lo, int hi) {
        return ((long) lo << 32) | (hi & 0xffffffffL);
    }

    /**
     * Minimal sequential token reader over a pre-split whitespace-delimited
     * token stream.
     */
    private static final class Tok {
        private final String[] tokens;
        private int idx = 0;

        Tok(String[] tokens) {
            this.tokens = tokens;
        }

        int nextInt() {
            return Integer.parseInt(tokens[idx++]);
        }

        float nextFloat() {
            return Float.parseFloat(tokens[idx++]);
        }
    }
}
