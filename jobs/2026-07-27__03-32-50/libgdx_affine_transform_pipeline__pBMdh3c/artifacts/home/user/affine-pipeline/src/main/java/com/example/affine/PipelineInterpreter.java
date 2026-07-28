package com.example.affine;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Parses and evaluates an affine-transform pipeline program, producing the
 * textual output described in the task specification.
 */
public final class PipelineInterpreter {

    private final Map<String, AffineMatrix> pipelines = new HashMap<>();
    private final List<String> output = new ArrayList<>();

    public void run(Path inputPath, Path outputPath) throws IOException {
        List<String> lines = Files.readAllLines(inputPath, StandardCharsets.UTF_8);

        int i = 0;
        while (i < lines.size()) {
            String raw = lines.get(i);
            String stripped = stripCommentAndTrim(raw);
            if (stripped.isEmpty()) {
                i++;
                continue;
            }

            String[] tokens = tokenize(stripped);
            String keyword = tokens[0];

            if (keyword.equals("define")) {
                String name = tokens[1];
                i++;
                AffineMatrix matrix = AffineMatrix.identity();
                while (i < lines.size()) {
                    String bodyStripped = stripCommentAndTrim(lines.get(i));
                    if (bodyStripped.isEmpty()) {
                        i++;
                        continue;
                    }
                    String[] bodyTokens = tokenize(bodyStripped);
                    if (bodyTokens[0].equals("end")) {
                        i++;
                        break;
                    }
                    matrix = matrix.multiply(operationMatrix(bodyTokens));
                    i++;
                }
                pipelines.put(name, matrix);
            } else if (keyword.equals("point")) {
                output.add(handlePoint(tokens));
                i++;
            } else if (keyword.equals("polygon")) {
                output.add(handlePolygon(tokens));
                i++;
            } else if (keyword.equals("inverse")) {
                output.add(handleInverse(tokens));
                i++;
            } else {
                throw new IllegalArgumentException("Unrecognized command: " + stripped);
            }
        }

        StringBuilder sb = new StringBuilder();
        for (String line : output) {
            sb.append(line).append('\n');
        }
        Files.write(outputPath, sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    private AffineMatrix operationMatrix(String[] tokens) {
        switch (tokens[0]) {
            case "translate":
                return AffineMatrix.translate(parseFloat(tokens[1]), parseFloat(tokens[2]));
            case "rotate":
                return AffineMatrix.rotate(parseFloat(tokens[1]));
            case "scale":
                return AffineMatrix.scale(parseFloat(tokens[1]), parseFloat(tokens[2]));
            case "shear":
                return AffineMatrix.shear(parseFloat(tokens[1]), parseFloat(tokens[2]));
            case "use":
                AffineMatrix referenced = pipelines.get(tokens[1]);
                if (referenced == null) {
                    throw new IllegalArgumentException("Undefined pipeline referenced: " + tokens[1]);
                }
                return referenced;
            default:
                throw new IllegalArgumentException("Unrecognized operation: " + tokens[0]);
        }
    }

    private String handlePoint(String[] tokens) {
        String name = tokens[1];
        double x = parseFloat(tokens[2]);
        double y = parseFloat(tokens[3]);
        AffineMatrix m = requirePipeline(name);
        double[] image = m.apply(x, y);

        StringBuilder sb = new StringBuilder();
        sb.append("point ").append(name).append(" matrix ").append(matrixTokens(m));
        sb.append(" image ").append(fmt(image[0])).append(' ').append(fmt(image[1]));
        return sb.toString();
    }

    private String handlePolygon(String[] tokens) {
        String name = tokens[1];
        int coordCount = tokens.length - 2;
        int k = coordCount / 2;
        double[] xs = new double[k];
        double[] ys = new double[k];
        for (int idx = 0; idx < k; idx++) {
            xs[idx] = parseFloat(tokens[2 + 2 * idx]);
            ys[idx] = parseFloat(tokens[2 + 2 * idx + 1]);
        }

        AffineMatrix m = requirePipeline(name);
        double[] txs = new double[k];
        double[] tys = new double[k];
        for (int idx = 0; idx < k; idx++) {
            double[] p = m.apply(xs[idx], ys[idx]);
            txs[idx] = p[0];
            tys[idx] = p[1];
        }

        double area = 0.0;
        for (int idx = 0; idx < k; idx++) {
            int next = (idx + 1) % k;
            area += txs[idx] * tys[next] - txs[next] * tys[idx];
        }
        area *= 0.5;

        double det = m.det();
        String orient;
        if (det > 0) {
            orient = "preserved";
        } else if (det < 0) {
            orient = "flipped";
        } else {
            orient = "degenerate";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("polygon ").append(name).append(" matrix ").append(matrixTokens(m));
        sb.append(" area ").append(fmt(area));
        sb.append(" orient ").append(orient);
        sb.append(" image");
        for (int idx = 0; idx < k; idx++) {
            sb.append(' ').append(fmt(txs[idx])).append(' ').append(fmt(tys[idx]));
        }
        return sb.toString();
    }

    private String handleInverse(String[] tokens) {
        String name = tokens[1];
        double x = parseFloat(tokens[2]);
        double y = parseFloat(tokens[3]);
        AffineMatrix m = requirePipeline(name);
        double det = m.det();

        StringBuilder sb = new StringBuilder();
        sb.append("inverse ").append(name).append(" matrix ").append(matrixTokens(m));

        if (det == 0.0) {
            sb.append(" singular");
            return sb.toString();
        }

        double[] q = m.apply(x, y);
        AffineMatrix n = m.inverse();
        double[] b = n.apply(q[0], q[1]);
        double dx = x - b[0];
        double dy = y - b[1];
        double residual = Math.sqrt(dx * dx + dy * dy);
        String status = residual <= 1e-3 ? "ok" : "fail";

        sb.append(" forward ").append(fmt(q[0])).append(' ').append(fmt(q[1]));
        sb.append(" back ").append(fmt(b[0])).append(' ').append(fmt(b[1]));
        sb.append(" residual ").append(fmt(residual));
        sb.append(' ').append(status);
        return sb.toString();
    }

    private AffineMatrix requirePipeline(String name) {
        AffineMatrix m = pipelines.get(name);
        if (m == null) {
            throw new IllegalArgumentException("Undefined pipeline: " + name);
        }
        return m;
    }

    private static String matrixTokens(AffineMatrix m) {
        return fmt(m.m00) + ' ' + fmt(m.m01) + ' ' + fmt(m.m02) + ' '
                + fmt(m.m10) + ' ' + fmt(m.m11) + ' ' + fmt(m.m12);
    }

    private static String fmt(double value) {
        String s = String.format(Locale.US, "%.4f", value);
        if (s.equals("-0.0000")) {
            s = "0.0000";
        }
        return s;
    }

    private static double parseFloat(String token) {
        return Float.parseFloat(token);
    }

    private static String stripCommentAndTrim(String line) {
        int hashIdx = line.indexOf('#');
        String withoutComment = hashIdx >= 0 ? line.substring(0, hashIdx) : line;
        return withoutComment.trim();
    }

    private static String[] tokenize(String line) {
        return line.trim().split("[ \\t]+");
    }
}
