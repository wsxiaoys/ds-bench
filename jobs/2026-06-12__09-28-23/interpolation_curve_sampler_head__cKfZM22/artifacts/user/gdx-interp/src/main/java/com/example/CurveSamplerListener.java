package com.example;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.Interpolation;

import java.io.*;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * ApplicationListener that samples a named Interpolation curve over the unit interval.
 *
 * Lifecycle:
 *   create()  - reads config, validates curve, allocates sample array
 *   render()  - produces exactly one sample per invocation
 *   dispose() - writes the output file
 */
public class CurveSamplerListener extends ApplicationAdapter {

    /** Valid curve names. */
    private static final Set<String> VALID_CURVES = new HashSet<>(Arrays.asList(
        "linear", "smooth", "smoother"
    ));

    private Interpolation interpolation;
    private float start;
    private float end;
    private int samples;
    private String curveName;
    private String outputPath;

    private float[] results;
    private int tick;
    private boolean error;

    @Override
    public void create() {
        try {
            // args: configPath outputPath - passed via a static holder from main()
            String configPath = ConfigHolder.configPath;
            String outputPathLocal = ConfigHolder.outputPath;

            if (configPath == null || outputPathLocal == null) {
                System.err.println("Usage: <config-path> <output-path>");
                error = true;
                Gdx.app.exit();
                return;
            }
            this.outputPath = outputPathLocal;

            // Read config
            Properties props = new Properties();
            try (Reader reader = Gdx.files.absolute(configPath).reader("UTF-8")) {
                props.load(reader);
            }

            // Parse fields
            curveName = props.getProperty("curve");
            if (curveName == null) {
                System.err.println("Missing required key 'curve' in config");
                error = true;
                Gdx.app.exit();
                return;
            }

            if (!VALID_CURVES.contains(curveName)) {
                System.err.println("Unknown curve: " + curveName);
                error = true;
                Gdx.app.exit();
                return;
            }

            String startStr = props.getProperty("start");
            String endStr = props.getProperty("end");
            String samplesStr = props.getProperty("samples");

            if (startStr == null || endStr == null || samplesStr == null) {
                System.err.println("Missing required keys in config (need: curve, start, end, samples)");
                error = true;
                Gdx.app.exit();
                return;
            }

            start = (float) Double.parseDouble(startStr);
            end = (float) Double.parseDouble(endStr);
            samples = Integer.parseInt(samplesStr);

            if (samples < 2) {
                System.err.println("samples must be >= 2, got: " + samples);
                error = true;
                Gdx.app.exit();
                return;
            }

            // Look up the interpolation via reflection
            Field field = Interpolation.class.getField(curveName);
            interpolation = (Interpolation) field.get(null);

            // Allocate results array
            results = new float[samples];
            tick = 0;

        } catch (Exception e) {
            System.err.println("Error during initialization: " + e.getMessage());
            error = true;
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        if (error) {
            return;
        }

        if (tick >= samples) {
            // Already done - shouldn't happen, but guard
            return;
        }

        // Compute t
        float t;
        if (samples == 1) {
            t = 1.0f;
        } else if (tick == samples - 1) {
            t = 1.0f;
        } else {
            t = (float) tick / (float) (samples - 1);
        }

        results[tick] = interpolation.apply(start, end, t);
        tick++;

        if (tick >= samples) {
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        if (error) {
            return;
        }

        try (PrintWriter pw = new PrintWriter(
                new OutputStreamWriter(
                    new FileOutputStream(outputPath), StandardCharsets.UTF_8))) {

            pw.printf(Locale.ROOT, "curve=%s%n", curveName);
            pw.printf(Locale.ROOT, "samples=%d%n", samples);

            for (int i = 0; i < samples; i++) {
                pw.printf(Locale.ROOT, "%.6f%n", results[i]);
            }

        } catch (IOException e) {
            System.err.println("Error writing output file: " + e.getMessage());
        }
    }

    /**
     * Static holder so the main method can pass CLI args into the listener
     * before the headless application starts.
     */
    static class ConfigHolder {
        static volatile String configPath;
        static volatile String outputPath;
    }
}
