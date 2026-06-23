package com.example.gdxinterp;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.math.Interpolation;

import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Properties;
import java.util.Set;

public final class InterpolationSamplerApp {
    private InterpolationSamplerApp() {
    }

    public static void main(String[] args) throws InterruptedException {
        if (args.length != 2) {
            System.err.println("Usage: <config-path> <output-path>");
            System.exit(2);
        }

        SamplerListener listener = new SamplerListener(args[0], args[1]);
        HeadlessApplicationConfiguration configuration = new HeadlessApplicationConfiguration();
        configuration.updatesPerSecond = 0;

        JoinableHeadlessApplication application = new JoinableHeadlessApplication(listener, configuration);
        application.joinMainLoop();

        if (listener.failed()) {
            System.exit(1);
        }
    }

    private static final class JoinableHeadlessApplication extends HeadlessApplication {
        private JoinableHeadlessApplication(SamplerListener listener, HeadlessApplicationConfiguration config) {
            super(listener, config);
        }

        private void joinMainLoop() throws InterruptedException {
            mainLoopThread.join();
        }
    }

    private static final class SamplerListener extends ApplicationAdapter {
        private static final Set<String> SUPPORTED_CURVES = Set.of("linear", "smooth", "smoother");

        private final String configPath;
        private final String outputPath;

        private String curveName;
        private Interpolation interpolation;
        private float start;
        private float end;
        private int samples;
        private float[] values;
        private int sampleIndex;
        private boolean initialized;
        private boolean completed;
        private volatile boolean failed;

        private SamplerListener(String configPath, String outputPath) {
            this.configPath = configPath;
            this.outputPath = outputPath;
        }

        @Override
        public void create() {
            try {
                Properties properties = new Properties();
                try (InputStream input = Gdx.files.absolute(configPath).read()) {
                    properties.load(input);
                }

                curveName = requireProperty(properties, "curve");
                if (!SUPPORTED_CURVES.contains(curveName)) {
                    throw new IllegalArgumentException("Unsupported curve '" + curveName
                            + "'. Supported curves: linear, smooth, smoother");
                }
                interpolation = lookupInterpolation(curveName);

                start = (float) Double.parseDouble(requireProperty(properties, "start"));
                end = (float) Double.parseDouble(requireProperty(properties, "end"));
                samples = Integer.parseInt(requireProperty(properties, "samples"));
                if (samples < 2) {
                    throw new IllegalArgumentException("samples must be >= 2");
                }

                values = new float[samples];
                initialized = true;
            } catch (Exception e) {
                fail(e.getMessage() == null ? e.toString() : e.getMessage());
            }
        }

        @Override
        public void render() {
            if (failed || !initialized || completed) {
                return;
            }
            if (sampleIndex >= samples) {
                return;
            }

            int i = sampleIndex;
            float t = i == samples - 1 ? 1.0f : i / (float) (samples - 1);
            values[i] = interpolation.apply(start, end, t);
            sampleIndex++;

            if (sampleIndex == samples) {
                completed = true;
                Gdx.app.exit();
            }
        }

        @Override
        public void dispose() {
            if (failed || !completed) {
                return;
            }

            StringBuilder output = new StringBuilder();
            output.append("curve=").append(curveName).append('\n');
            output.append("samples=").append(samples).append('\n');
            for (float value : values) {
                output.append(String.format(Locale.ROOT, "%.6f%n", value));
            }

            try {
                Files.writeString(Path.of(outputPath), output.toString(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                fail("Failed to write output file: " + e.getMessage());
            }
        }

        private boolean failed() {
            return failed;
        }

        private void fail(String message) {
            failed = true;
            System.err.println(message);
            Gdx.app.exit();
        }

        private static String requireProperty(Properties properties, String key) {
            String value = properties.getProperty(key);
            if (value == null) {
                throw new IllegalArgumentException("Missing required property: " + key);
            }
            return value.trim();
        }

        private static Interpolation lookupInterpolation(String curveName) throws ReflectiveOperationException {
            Field field = Interpolation.class.getField(curveName);
            Object value = field.get(null);
            if (!(value instanceof Interpolation interpolation)) {
                throw new IllegalArgumentException("Interpolation." + curveName + " is not an Interpolation");
            }
            return interpolation;
        }
    }
}
