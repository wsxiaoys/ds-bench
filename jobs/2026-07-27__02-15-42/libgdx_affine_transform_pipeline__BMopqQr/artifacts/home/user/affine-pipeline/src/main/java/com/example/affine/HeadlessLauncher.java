package com.example.affine;

import com.badlogicgames.gdx.ApplicationListener;
import com.badlogicgames.gdx.backends.headless.HeadlessApplication;
import com.badlogicgames.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class HeadlessLauncher implements ApplicationListener {

    private final String[] args;

    public HeadlessLauncher(String[] args) {
        this.args = args;
    }

    public static void main(String[] args) {
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        new HeadlessApplication(new HeadlessLauncher(args), config);
    }

    @Override
    public void create() {
        try {
            runInterpreter();
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        } finally {
            System.exit(0);
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

    public static class AffineMatrix {
        double m00, m01, m02;
        double m10, m11, m12;

        public AffineMatrix() {
            this.m00 = 1.0; this.m01 = 0.0; this.m02 = 0.0;
            this.m10 = 0.0; this.m11 = 1.0; this.m12 = 0.0;
        }

        public AffineMatrix(double m00, double m01, double m02, double m10, double m11, double m12) {
            this.m00 = m00; this.m01 = m01; this.m02 = m02;
            this.m10 = m10; this.m11 = m11; this.m12 = m12;
        }

        public static AffineMatrix translate(double tx, double ty) {
            return new AffineMatrix(1.0, 0.0, tx, 0.0, 1.0, ty);
        }

        public static AffineMatrix rotate(double degrees) {
            double rad = Math.toRadians(degrees);
            double cos = Math.cos(rad);
            double sin = Math.sin(rad);
            return new AffineMatrix(cos, -sin, 0.0, sin, cos, 0.0);
        }

        public static AffineMatrix scale(double sx, double sy) {
            return new AffineMatrix(sx, 0.0, 0.0, 0.0, sy, 0.0);
        }

        public static AffineMatrix shear(double shx, double shy) {
            return new AffineMatrix(1.0, shx, 0.0, shy, 1.0, 0.0);
        }

        public AffineMatrix multiply(AffineMatrix o) {
            double r00 = this.m00 * o.m00 + this.m01 * o.m10;
            double r01 = this.m00 * o.m01 + this.m01 * o.m11;
            double r02 = this.m00 * o.m02 + this.m01 * o.m12 + this.m02;

            double r10 = this.m10 * o.m00 + this.m11 * o.m10;
            double r11 = this.m10 * o.m01 + this.m11 * o.m11;
            double r12 = this.m10 * o.m02 + this.m11 * o.m12 + this.m12;

            return new AffineMatrix(r00, r01, r02, r10, r11, r12);
        }

        public double getDeterminant() {
            return m00 * m11 - m01 * m10;
        }

        public AffineMatrix invert() {
            double det = getDeterminant();
            if (det == 0.0) {
                return null;
            }
            double n00 = m11 / det;
            double n01 = -m01 / det;
            double n10 = -m10 / det;
            double n11 = m00 / det;
            double n02 = -(n00 * m02 + n01 * m12);
            double n12 = -(n10 * m02 + n11 * m12);
            return new AffineMatrix(n00, n01, n02, n10, n11, n12);
        }

        public double[] transform(double x, double y) {
            double tx = m00 * x + m01 * y + m02;
            double ty = m10 * x + m11 * y + m12;
            return new double[]{tx, ty};
        }
    }

    private static String formatDouble(double val) {
        String s = String.format(Locale.US, "%.4f", val);
        if (s.equals("-0.0000")) {
            return "0.0000";
        }
        return s;
    }

    private static double computeSignedArea(double[] x, double[] y) {
        int k = x.length;
        double sum = 0.0;
        for (int i = 0; i < k; i++) {
            int next = (i + 1) % k;
            sum += x[i] * y[next] - x[next] * y[i];
        }
        return 0.5 * sum;
    }

    private void runInterpreter() throws Exception {
        String inputPath = null;
        String outputPath = null;
        for (String arg : args) {
            if (arg.startsWith("--input=")) {
                inputPath = arg.substring("--input=".length());
            } else if (arg.startsWith("--output=")) {
                outputPath = arg.substring("--output=".length());
            }
        }

        if (inputPath == null || outputPath == null) {
            System.err.println("Error: Missing --input or --output argument.");
            System.exit(1);
        }

        Map<String, AffineMatrix> pipelines = new HashMap<>();
        List<String> outputLines = new ArrayList<>();

        boolean inDefine = false;
        String currentPipelineName = null;
        AffineMatrix currentMatrix = null;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(inputPath), StandardCharsets.UTF_8))) {
            String rawLine;
            while ((rawLine = reader.readLine()) != null) {
                String line = rawLine;
                int commentIdx = line.indexOf('#');
                if (commentIdx >= 0) {
                    line = line.substring(0, commentIdx);
                }
                line = line.trim();
                if (line.isEmpty()) {
                    continue;
                }

                String[] tokens = line.split("[ \t]+");
                if (tokens.length == 0 || tokens[0].isEmpty()) {
                    continue;
                }

                String cmd = tokens[0];

                if (inDefine) {
                    if (cmd.equals("end")) {
                        pipelines.put(currentPipelineName, currentMatrix);
                        inDefine = false;
                    } else if (cmd.equals("translate")) {
                        double tx = Double.parseDouble(tokens[1]);
                        double ty = Double.parseDouble(tokens[2]);
                        currentMatrix = currentMatrix.multiply(AffineMatrix.translate(tx, ty));
                    } else if (cmd.equals("rotate")) {
                        double deg = Double.parseDouble(tokens[1]);
                        currentMatrix = currentMatrix.multiply(AffineMatrix.rotate(deg));
                    } else if (cmd.equals("scale")) {
                        double sx = Double.parseDouble(tokens[1]);
                        double sy = Double.parseDouble(tokens[2]);
                        currentMatrix = currentMatrix.multiply(AffineMatrix.scale(sx, sy));
                    } else if (cmd.equals("shear")) {
                        double shx = Double.parseDouble(tokens[1]);
                        double shy = Double.parseDouble(tokens[2]);
                        currentMatrix = currentMatrix.multiply(AffineMatrix.shear(shx, shy));
                    } else if (cmd.equals("use")) {
                        String otherName = tokens[1];
                        AffineMatrix otherMatrix = pipelines.get(otherName);
                        if (otherMatrix == null) {
                            throw new RuntimeException("Pipeline " + otherName + " is not defined before use.");
                        }
                        currentMatrix = currentMatrix.multiply(otherMatrix);
                    } else {
                        throw new RuntimeException("Unknown operation in define block: " + cmd);
                    }
                } else {
                    if (cmd.equals("define")) {
                        inDefine = true;
                        currentPipelineName = tokens[1];
                        currentMatrix = new AffineMatrix();
                    } else if (cmd.equals("point")) {
                        String name = tokens[1];
                        double x = Double.parseDouble(tokens[2]);
                        double y = Double.parseDouble(tokens[3]);
                        AffineMatrix M = pipelines.get(name);
                        if (M == null) {
                            throw new RuntimeException("Pipeline " + name + " is not defined.");
                        }
                        double[] q = M.transform(x, y);
                        String out = "point " + name + " matrix " +
                                formatDouble(M.m00) + " " + formatDouble(M.m01) + " " + formatDouble(M.m02) + " " +
                                formatDouble(M.m10) + " " + formatDouble(M.m11) + " " + formatDouble(M.m12) + " " +
                                "image " + formatDouble(q[0]) + " " + formatDouble(q[1]);
                        outputLines.add(out);
                    } else if (cmd.equals("polygon")) {
                        String name = tokens[1];
                        int k = (tokens.length - 2) / 2;
                        AffineMatrix M = pipelines.get(name);
                        if (M == null) {
                            throw new RuntimeException("Pipeline " + name + " is not defined.");
                        }
                        double[] transX = new double[k];
                        double[] transY = new double[k];
                        StringBuilder imgBuilder = new StringBuilder();
                        for (int i = 0; i < k; i++) {
                            double px = Double.parseDouble(tokens[2 + 2 * i]);
                            double py = Double.parseDouble(tokens[2 + 2 * i + 1]);
                            double[] q = M.transform(px, py);
                            transX[i] = q[0];
                            transY[i] = q[1];
                            if (i > 0) {
                                imgBuilder.append(" ");
                            }
                            imgBuilder.append(formatDouble(q[0])).append(" ").append(formatDouble(q[1]));
                        }
                        double signedArea = computeSignedArea(transX, transY);
                        double det = M.getDeterminant();
                        String orient;
                        if (det > 0.0) {
                            orient = "preserved";
                        } else if (det < 0.0) {
                            orient = "flipped";
                        } else {
                            orient = "degenerate";
                        }
                        String out = "polygon " + name + " matrix " +
                                formatDouble(M.m00) + " " + formatDouble(M.m01) + " " + formatDouble(M.m02) + " " +
                                formatDouble(M.m10) + " " + formatDouble(M.m11) + " " + formatDouble(M.m12) + " " +
                                "area " + formatDouble(signedArea) + " orient " + orient + " image " + imgBuilder.toString();
                        outputLines.add(out);
                    } else if (cmd.equals("inverse")) {
                        String name = tokens[1];
                        double x = Double.parseDouble(tokens[2]);
                        double y = Double.parseDouble(tokens[3]);
                        AffineMatrix M = pipelines.get(name);
                        if (M == null) {
                            throw new RuntimeException("Pipeline " + name + " is not defined.");
                        }
                        double det = M.getDeterminant();
                        String matrixStr = formatDouble(M.m00) + " " + formatDouble(M.m01) + " " + formatDouble(M.m02) + " " +
                                           formatDouble(M.m10) + " " + formatDouble(M.m11) + " " + formatDouble(M.m12);
                        if (det == 0.0) {
                            outputLines.add("inverse " + name + " matrix " + matrixStr + " singular");
                        } else {
                            double[] q = M.transform(x, y);
                            AffineMatrix N = M.invert();
                            double[] b = N.transform(q[0], q[1]);
                            double residual = Math.sqrt((x - b[0]) * (x - b[0]) + (y - b[1]) * (y - b[1]));
                            String status = (residual <= 1e-3) ? "ok" : "fail";
                            String out = "inverse " + name + " matrix " + matrixStr + " forward " +
                                    formatDouble(q[0]) + " " + formatDouble(q[1]) + " back " +
                                    formatDouble(b[0]) + " " + formatDouble(b[1]) + " residual " +
                                    formatDouble(residual) + " " + status;
                            outputLines.add(out);
                        }
                    } else {
                        throw new RuntimeException("Unknown command: " + cmd);
                    }
                }
            }
        }

        File outputFile = new File(outputPath);
        File parentDir = outputFile.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
        }

        try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(outputFile), StandardCharsets.UTF_8))) {
            for (String line : outputLines) {
                writer.write(line);
                writer.write("\n");
            }
        }
    }
}
