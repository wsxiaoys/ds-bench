package com.mygdx.interp;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.math.Interpolation;

import java.io.File;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;

public class Main implements ApplicationListener {
    private final String configPath;
    private final String outputPath;
    private final CountDownLatch startLatch;
    private final CountDownLatch doneLatch;

    private String curveName;
    private Interpolation interpolation;
    private float startVal;
    private float endVal;
    private int samples;

    private int tick = 0;
    private List<Float> samplesList;

    public Main(String configPath, String outputPath, CountDownLatch startLatch, CountDownLatch doneLatch) {
        this.configPath = configPath;
        this.outputPath = outputPath;
        this.startLatch = startLatch;
        this.doneLatch = doneLatch;
    }

    @Override
    public void create() {
        try {
            // Read config via Gdx.files.absolute(...)
            Properties props = new Properties();
            try (InputStream in = Gdx.files.absolute(configPath).read()) {
                props.load(in);
            } catch (Exception e) {
                System.err.println("Error: Failed to read config file: " + e.getMessage());
                System.exit(1);
            }

            curveName = props.getProperty("curve");
            if (curveName == null) {
                System.err.println("Error: 'curve' key is missing in config file.");
                System.exit(1);
            }

            // Supported curve names: linear, smooth, smoother
            if (!"linear".equals(curveName) && !"smooth".equals(curveName) && !"smoother".equals(curveName)) {
                System.err.println("Error: Unsupported curve name '" + curveName + "'. Only 'linear', 'smooth', and 'smoother' are supported.");
                System.exit(1);
            }

            try {
                Field field = Interpolation.class.getField(curveName);
                interpolation = (Interpolation) field.get(null);
            } catch (Exception e) {
                System.err.println("Error: Failed to look up curve field '" + curveName + "' on Interpolation class.");
                System.exit(1);
            }

            String startStr = props.getProperty("start");
            String endStr = props.getProperty("end");
            String samplesStr = props.getProperty("samples");

            if (startStr == null || endStr == null || samplesStr == null) {
                System.err.println("Error: 'start', 'end', or 'samples' key is missing in config file.");
                System.exit(1);
            }

            try {
                startVal = (float) Double.parseDouble(startStr);
                endVal = (float) Double.parseDouble(endStr);
            } catch (NumberFormatException e) {
                System.err.println("Error: 'start' or 'end' value is not a valid double.");
                System.exit(1);
            }

            try {
                samples = Integer.parseInt(samplesStr);
            } catch (NumberFormatException e) {
                System.err.println("Error: 'samples' value is not a valid integer.");
                System.exit(1);
            }

            if (samples < 2) {
                System.err.println("Error: 'samples' must be >= 2.");
                System.exit(1);
            }

            samplesList = new ArrayList<>(samples);
        } finally {
            // Signal that initialization has completed (even if we exited, we don't want to block main thread)
            startLatch.countDown();
        }
    }

    @Override
    public void resize(int width, int height) {
    }

    @Override
    public void render() {
        if (tick < samples) {
            float t;
            if (tick == samples - 1) {
                t = 1.0f;
            } else {
                t = (float) tick / (samples - 1);
            }
            float sample = interpolation.apply(startVal, endVal, t);
            samplesList.add(sample);
            tick++;
            if (tick == samples) {
                Gdx.app.exit();
            }
        }
    }

    @Override
    public void pause() {
    }

    @Override
    public void resume() {
    }

    @Override
    public void dispose() {
        try {
            if (samplesList != null && samplesList.size() == samples) {
                StringBuilder sb = new StringBuilder();
                sb.append("curve=").append(curveName).append("\n");
                sb.append("samples=").append(samples).append("\n");
                for (float val : samplesList) {
                    sb.append(String.format(Locale.ROOT, "%.6f", val)).append("\n");
                }
                Files.write(Paths.get(outputPath), sb.toString().getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception e) {
            System.err.println("Error: Failed to write output file: " + e.getMessage());
        } finally {
            doneLatch.countDown();
        }
    }

    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Error: Missing arguments.");
            System.err.println("Usage: ./gradlew run --args=\"<config-path> <output-path>\"");
            System.exit(1);
        }

        String configPath = new File(args[0]).getAbsolutePath();
        String outputPath = new File(args[1]).getAbsolutePath();

        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(1);

        Main listener = new Main(configPath, outputPath, startLatch, doneLatch);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0; // run as fast as possible

        // Start headless application
        new HeadlessApplication(listener, config);

        try {
            // Wait for initialization to complete
            startLatch.await();

            // Find the main loop thread to join it later
            Thread headlessThread = null;
            for (Thread t : Thread.getAllStackTraces().keySet()) {
                if (t.getName().contains("HeadlessApplication")) {
                    headlessThread = t;
                    break;
                }
            }

            // Wait for the application to finish rendering and write the output
            doneLatch.await();

            // Join the main loop thread to ensure clean exit
            if (headlessThread != null) {
                headlessThread.join();
            }
        } catch (InterruptedException e) {
            System.err.println("Error: Main thread interrupted: " + e.getMessage());
            System.exit(1);
        }

        // Clean exit
        System.exit(0);
    }
}
