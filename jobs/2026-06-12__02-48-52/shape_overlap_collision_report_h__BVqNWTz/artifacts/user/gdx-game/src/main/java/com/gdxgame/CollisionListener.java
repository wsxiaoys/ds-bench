package com.gdxgame;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.math.Circle;
import com.badlogic.gdx.math.Intersector;
import com.badlogic.gdx.math.Rectangle;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FileWriter;
import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

/**
 * libGDX ApplicationAdapter that:
 *  1. Loads and parses the shapes file.
 *  2. Computes every overlapping pair using libGDX math primitives.
 *  3. Writes the sorted collision report.
 *  4. Calls Gdx.app.exit().
 *
 * Any parse or validation error is communicated back to the Launcher via
 * the errorMessage field; the Launcher reads it after the headless
 * main loop terminates and exits with a non-zero status code.
 */
public class CollisionListener extends ApplicationAdapter {

    private final String shapesPath;
    private final String outputPath;
    private final CountDownLatch done;

    /** Set to a non-null value when a fatal error is encountered. */
    volatile String errorMessage = null;

    public CollisionListener(String shapesPath, String outputPath, CountDownLatch done) {
        this.shapesPath = shapesPath;
        this.outputPath = outputPath;
        this.done = done;
    }

    @Override
    public void create() {
        try {
            run();
        } catch (Exception e) {
            if (errorMessage == null) {
                errorMessage = "Error: unexpected exception: " + e.getMessage();
            }
        } finally {
            Gdx.app.exit();
            done.countDown();
        }
    }

    private void run() throws IOException {
        // 1. Load file
        FileHandle fh = Gdx.files.absolute(shapesPath);
        if (!fh.exists()) {
            errorMessage = "Error: shapes file not found: " + shapesPath;
            return;
        }
        String content = fh.readString("UTF-8");

        // 2. Parse shapes
        List<ShapeEntry> shapes = new ArrayList<>();
        // Use a map to detect duplicate IDs while preserving insertion order.
        Map<String, Boolean> seenIds = new LinkedHashMap<>();

        try (BufferedReader reader = new BufferedReader(new StringReader(content))) {
            String raw;
            while ((raw = reader.readLine()) != null) {
                String line = raw.strip();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                String[] tokens = line.split("\\s+");

                if (tokens.length < 2) {
                    errorMessage = "Error: invalid shape line: " + raw;
                    return;
                }

                String id = tokens[0];
                String keyword = tokens[1];

                // Validate id characters: letters, digits, underscores, hyphens
                if (!id.matches("[A-Za-z0-9_\\-]+")) {
                    errorMessage = "Error: invalid shape line: " + raw;
                    return;
                }

                // Check for duplicate id
                if (seenIds.containsKey(id)) {
                    errorMessage = "Error: duplicate id " + id;
                    return;
                }
                seenIds.put(id, Boolean.TRUE);

                switch (keyword) {
                    case "rect": {
                        if (tokens.length != 6) {
                            errorMessage = "Error: invalid shape line: " + raw;
                            return;
                        }
                        float x, y, w, h;
                        try {
                            x = Float.parseFloat(tokens[2]);
                            y = Float.parseFloat(tokens[3]);
                            w = Float.parseFloat(tokens[4]);
                            h = Float.parseFloat(tokens[5]);
                        } catch (NumberFormatException e) {
                            errorMessage = "Error: invalid shape line: " + raw;
                            return;
                        }
                        if (w <= 0 || h <= 0) {
                            errorMessage = "Error: invalid shape line: " + raw;
                            return;
                        }
                        shapes.add(new ShapeEntry(id, new Rectangle(x, y, w, h)));
                        break;
                    }
                    case "circle": {
                        if (tokens.length != 5) {
                            errorMessage = "Error: invalid shape line: " + raw;
                            return;
                        }
                        float x, y, r;
                        try {
                            x = Float.parseFloat(tokens[2]);
                            y = Float.parseFloat(tokens[3]);
                            r = Float.parseFloat(tokens[4]);
                        } catch (NumberFormatException e) {
                            errorMessage = "Error: invalid shape line: " + raw;
                            return;
                        }
                        if (r <= 0) {
                            errorMessage = "Error: invalid shape line: " + raw;
                            return;
                        }
                        shapes.add(new ShapeEntry(id, new Circle(x, y, r)));
                        break;
                    }
                    default: {
                        errorMessage = "Error: invalid shape line: " + raw;
                        return;
                    }
                }
            }
        }

        // 3. Compute overlapping pairs
        List<String[]> pairs = new ArrayList<>();

        for (int i = 0; i < shapes.size(); i++) {
            for (int j = i + 1; j < shapes.size(); j++) {
                ShapeEntry a = shapes.get(i);
                ShapeEntry b = shapes.get(j);

                boolean overlaps = checkOverlap(a, b);
                if (overlaps) {
                    // Lexicographically smaller id goes first
                    String idA, idB;
                    if (a.id.compareTo(b.id) <= 0) {
                        idA = a.id;
                        idB = b.id;
                    } else {
                        idA = b.id;
                        idB = a.id;
                    }
                    pairs.add(new String[]{idA, idB});
                }
            }
        }

        // 4. Sort pairs: primary key = idA, secondary key = idB
        pairs.sort((p1, p2) -> {
            int cmp = p1[0].compareTo(p2[0]);
            if (cmp != 0) return cmp;
            return p1[1].compareTo(p2[1]);
        });

        // 5. Write report
        try (BufferedWriter writer = new BufferedWriter(
                new FileWriter(outputPath, StandardCharsets.UTF_8, false))) {
            for (String[] pair : pairs) {
                writer.write(pair[0]);
                writer.write('\t');
                writer.write(pair[1]);
                writer.write('\n');
            }
            writer.write("total_overlaps=" + pairs.size());
            writer.write('\n');
        }
    }

    /**
     * Uses libGDX collision primitives to check whether two shapes overlap.
     */
    private boolean checkOverlap(ShapeEntry a, ShapeEntry b) {
        if (a.type == ShapeEntry.Type.RECT && b.type == ShapeEntry.Type.RECT) {
            return a.rect.overlaps(b.rect);
        } else if (a.type == ShapeEntry.Type.CIRCLE && b.type == ShapeEntry.Type.CIRCLE) {
            return a.circle.overlaps(b.circle);
        } else {
            // Mixed: one circle, one rectangle
            Circle c = (a.type == ShapeEntry.Type.CIRCLE) ? a.circle : b.circle;
            Rectangle r = (a.type == ShapeEntry.Type.RECT) ? a.rect : b.rect;
            return Intersector.overlaps(c, r);
        }
    }
}
