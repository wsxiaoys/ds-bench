package com.gdxinterp;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.math.Interpolation;

import java.io.*;
import java.util.Locale;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;

public class CurveSampler {

    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: CurveSampler <config-path> <output-path>");
            System.exit(1);
        }

        String configPath = args[0];
        String outputPath = args[1];

        // Read config to validate before starting the application
        Properties props = new Properties();
        try (InputStream is = new FileInputStream(configPath)) {
            props.load(is);
        } catch (IOException e) {
            System.err.println("Error reading config file: " + e.getMessage());
            System.exit(1);
        }

        String curveName = props.getProperty("curve");
        if (curveName == null) {
            System.err.println("Missing required property: curve");
            System.exit(1);
        }

        // Validate curve name by looking it up on Interpolation class
        Interpolation interpolation;
        try {
            java.lang.reflect.Field field = Interpolation.class.getField(curveName);
            Object obj = field.get(null);
            if (!(obj instanceof Interpolation)) {
                System.err.println("Unknown curve: " + curveName);
                System.exit(1);
                return;
            }
            interpolation = (Interpolation) obj;
        } catch (NoSuchFieldException | IllegalAccessException e) {
            System.err.println("Unknown curve: " + curveName);
            System.exit(1);
            return;
        }

        String startStr = props.getProperty("start");
        String endStr = props.getProperty("end");
        String samplesStr = props.getProperty("samples");

        if (startStr == null || endStr == null || samplesStr == null) {
            System.err.println("Missing required properties: start, end, samples");
            System.exit(1);
        }

        float start;
        float end;
        int samples;

        try {
            start = (float) Double.parseDouble(startStr);
        } catch (NumberFormatException e) {
            System.err.println("Invalid start value: " + startStr);
            System.exit(1);
            return;
        }

        try {
            end = (float) Double.parseDouble(endStr);
        } catch (NumberFormatException e) {
            System.err.println("Invalid end value: " + endStr);
            System.exit(1);
            return;
        }

        try {
            samples = Integer.parseInt(samplesStr);
        } catch (NumberFormatException e) {
            System.err.println("Invalid samples value: " + samplesStr);
            System.exit(1);
            return;
        }

        if (samples < 2) {
            System.err.println("samples must be >= 2");
            System.exit(1);
        }

        CountDownLatch latch = new CountDownLatch(1);

        SamplerListener listener = new SamplerListener(
                configPath, outputPath, curveName, start, end, samples, interpolation, latch
        );

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        new HeadlessApplication(listener, config);

        // Wait for dispose() to complete and output file to be written
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    static class SamplerListener extends ApplicationAdapter {
        private final String configPath;
        private final String outputPath;
        private final String curveName;
        private final float start;
        private final float end;
        private final int samples;
        private final Interpolation interpolation;
        private final CountDownLatch latch;

        private float[] results;
        private int tickCount = 0;

        SamplerListener(String configPath, String outputPath, String curveName,
                        float start, float end, int samples,
                        Interpolation interpolation, CountDownLatch latch) {
            this.configPath = configPath;
            this.outputPath = outputPath;
            this.curveName = curveName;
            this.start = start;
            this.end = end;
            this.samples = samples;
            this.interpolation = interpolation;
            this.latch = latch;
        }

        @Override
        public void create() {
            // Read config via Gdx.files.absolute(...) as required
            try {
                Properties props = new Properties();
                try (InputStream is = Gdx.files.absolute(configPath).read()) {
                    props.load(is);
                }
            } catch (IOException e) {
                System.err.println("Error reading config via Gdx.files: " + e.getMessage());
                Gdx.app.exit();
                return;
            }

            results = new float[samples];
        }

        @Override
        public void render() {
            if (tickCount >= samples) {
                return;
            }

            float t;
            if (tickCount == samples - 1) {
                t = 1.0f;
            } else {
                t = tickCount / (float) (samples - 1);
            }

            results[tickCount] = interpolation.apply(start, end, t);
            tickCount++;

            if (tickCount >= samples) {
                Gdx.app.exit();
            }
        }

        @Override
        public void dispose() {
            try (BufferedWriter writer = new BufferedWriter(
                    new OutputStreamWriter(new FileOutputStream(outputPath), "UTF-8"))) {
                writer.write("curve=" + curveName + "\n");
                writer.write("samples=" + samples + "\n");
                for (float value : results) {
                    writer.write(String.format(Locale.ROOT, "%.6f", value) + "\n");
                }
            } catch (IOException e) {
                System.err.println("Error writing output: " + e.getMessage());
            } finally {
                latch.countDown();
            }
        }
    }
}