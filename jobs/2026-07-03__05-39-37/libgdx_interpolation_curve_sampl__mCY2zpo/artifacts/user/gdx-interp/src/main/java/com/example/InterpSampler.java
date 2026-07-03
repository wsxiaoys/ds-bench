package com.example;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.math.Interpolation;

import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.io.Writer;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Properties;

/**
 * Drives the libGDX {@link Interpolation} API from inside an
 * {@link com.badlogic.gdx.ApplicationListener} running under a headless
 * backend, samples a named easing curve over the unit interval and writes the
 * resulting samples to a file.
 *
 * <p>Bootstrapped from {@link #main(String[])} which constructs a
 * {@link JoinableHeadlessApplication}.</p>
 */
public class InterpSampler {

    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: InterpSampler <config-path> <output-path>");
            System.exit(2);
        }
        final String configPath = args[0];
        final String outputPath = args[1];

        SamplerListener listener = new SamplerListener(configPath, outputPath);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // updatesPerSecond = 0 => run the main loop as fast as possible with no
        // wall-clock pacing, which is what we want for a finite deterministic sweep.
        config.updatesPerSecond = 0;

        JoinableHeadlessApplication app =
                new JoinableHeadlessApplication(listener, config);

        try {
            // Block until the main-loop thread has finished (i.e. until exit()
            // has been processed and dispose() has run and flushed the file).
            app.awaitStop();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        if (listener.error != null) {
            String msg = listener.error.getMessage();
            if (msg == null) {
                msg = listener.error.getClass().getSimpleName();
            }
            System.err.println("Error: " + msg);
            System.exit(1);
        }
        System.exit(0);
    }

    /**
     * The {@link com.badlogic.gdx.ApplicationListener} that performs the actual
     * sampling. Exactly one new sample is produced per {@link #render()}
     * invocation; after exactly {@code samples} ticks {@link Gdx#app}
     * {@code .exit()} is requested. The output file is written from
     * {@link #dispose()} so it is guaranteed to be flushed before the JVM exits.
     */
    static final class SamplerListener extends ApplicationAdapter {

        private final String configPath;
        private final String outputPath;

        // Parsed configuration.
        private String curveName;
        private float start;
        private float end;
        private int samples;

        // Runtime state.
        private Interpolation curve;
        private float[] results;
        private int tickCount = 0;
        private boolean finished = false;

        // If non-null, an error occurred during create(); the program must exit
        // non-zero and must NOT create/overwrite the output file.
        Throwable error;

        SamplerListener(String configPath, String outputPath) {
            this.configPath = configPath;
            this.outputPath = outputPath;
        }

        @Override
        public void create() {
            try {
                Properties props = new Properties();
                // Exercise the libGDX FileHandle abstraction as required.
                try (java.io.Reader reader = new java.io.InputStreamReader(
                        Gdx.files.absolute(configPath).read(), StandardCharsets.UTF_8)) {
                    props.load(reader);
                }

                curveName = props.getProperty("curve");
                if (curveName == null) {
                    throw new IllegalArgumentException("Missing required property 'curve'");
                }

                String startStr = props.getProperty("start");
                if (startStr == null) {
                    throw new IllegalArgumentException("Missing required property 'start'");
                }
                String endStr = props.getProperty("end");
                if (endStr == null) {
                    throw new IllegalArgumentException("Missing required property 'end'");
                }
                String samplesStr = props.getProperty("samples");
                if (samplesStr == null) {
                    throw new IllegalArgumentException("Missing required property 'samples'");
                }

                start = Float.parseFloat(startStr.trim());
                end = Float.parseFloat(endStr.trim());
                samples = Integer.parseInt(samplesStr.trim());
                if (samples < 2) {
                    throw new IllegalArgumentException("'samples' must be >= 2, got " + samples);
                }

                curve = lookupCurve(curveName.trim());
                if (curve == null) {
                    throw new IllegalArgumentException("Unknown or invalid curve: " + curveName);
                }

                results = new float[samples];
            } catch (Throwable t) {
                error = t;
                // Request shutdown; dispose() will see error != null and skip
                // writing the output file.
                Gdx.app.exit();
            }
        }

        @Override
        public void render() {
            if (error != null || finished) {
                return;
            }
            if (tickCount >= samples) {
                // Defensive: no additional samples after the sweep is complete.
                return;
            }

            int i = tickCount;
            float t;
            if (i == samples - 1) {
                // Force the exact endpoint to avoid floating-point drift.
                t = 1.0f;
            } else {
                t = i / (float) (samples - 1);
            }
            results[i] = curve.apply(start, end, t);
            tickCount++;

            if (tickCount == samples) {
                finished = true;
                Gdx.app.exit();
            }
        }

        @Override
        public void dispose() {
            if (error != null) {
                // Do NOT create or overwrite the output file on error.
                return;
            }
            writeOutput();
        }

        /**
         * Look up a named static {@link Interpolation} field on
         * {@link Interpolation} (e.g. {@code linear}, {@code smooth},
         * {@code smoother}). Returns {@code null} if the field does not exist or
         * is not an {@link Interpolation}.
         */
        private static Interpolation lookupCurve(String name) {
            try {
                Field f = Interpolation.class.getField(name);
                if (!java.lang.reflect.Modifier.isStatic(f.getModifiers())) {
                    return null;
                }
                Object o = f.get(null);
                if (o instanceof Interpolation) {
                    return (Interpolation) o;
                }
                return null;
            } catch (NoSuchFieldException | IllegalAccessException e) {
                return null;
            }
        }

        private void writeOutput() {
            Path out = Paths.get(outputPath);
            Path parent = out.getParent();
            if (parent != null) {
                try {
                    Files.createDirectories(parent);
                } catch (Exception e) {
                    error = e;
                    return;
                }
            }
            // Use explicit '\n' to guarantee LF line endings regardless of OS.
            try (Writer raw = new OutputStreamWriter(
                    Files.newOutputStream(out), StandardCharsets.UTF_8);
                 PrintWriter pw = new PrintWriter(raw)) {
                pw.print("curve=" + curveName + "\n");
                pw.print("samples=" + samples + "\n");
                for (int i = 0; i < samples; i++) {
                    pw.printf(Locale.ROOT, "%.6f\n", (double) results[i]);
                }
                pw.flush();
            } catch (Exception e) {
                error = e;
            }
        }
    }
}