package com.example.gdxinterp;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.math.Interpolation;

import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;

/**
 * Samples a named libGDX easing curve over [start, end] at equally-spaced
 * t-values and writes the results to a file.
 *
 * Usage: InterpolationSampler <config-path> <output-path>
 */
public class InterpolationSampler extends ApplicationAdapter {

    // -----------------------------------------------------------------------
    // Allowed curve names and their Interpolation instances
    // -----------------------------------------------------------------------
    private static Interpolation resolveInterpolation(String name) {
        switch (name) {
            case "linear":   return Interpolation.linear;
            case "smooth":   return Interpolation.smooth;
            case "smoother": return Interpolation.smoother;
            default:         return null;
        }
    }

    // -----------------------------------------------------------------------
    // Instance state
    // -----------------------------------------------------------------------
    private final String configPath;
    private final String outputPath;
    private final CountDownLatch doneLatch;

    // Parsed from config inside create()
    private String curveName;
    private float  start;
    private float  end;
    private int    samples;
    private Interpolation interp;

    // Sampling state
    private final List<Float> results = new ArrayList<>();
    private int tickCount = 0;

    // If something goes wrong inside the listener, record it here
    private volatile Throwable listenerError = null;

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------
    public InterpolationSampler(String configPath, String outputPath,
                                CountDownLatch doneLatch) {
        this.configPath = configPath;
        this.outputPath = outputPath;
        this.doneLatch  = doneLatch;
    }

    // -----------------------------------------------------------------------
    // ApplicationAdapter lifecycle
    // -----------------------------------------------------------------------
    @Override
    public void create() {
        try {
            // Read config via Gdx.files so the libGDX FileHandle API is exercised
            Properties props = new Properties();
            try (InputStream in = Gdx.files.absolute(configPath).read()) {
                props.load(in);
            }

            curveName = props.getProperty("curve");
            if (curveName == null || curveName.isEmpty()) {
                throw new IllegalArgumentException("Config missing required key: curve");
            }

            interp = resolveInterpolation(curveName);
            if (interp == null) {
                throw new IllegalArgumentException(
                        "Unknown curve name: \"" + curveName + "\". "
                        + "Supported: linear, smooth, smoother");
            }

            String startStr   = props.getProperty("start");
            String endStr     = props.getProperty("end");
            String samplesStr = props.getProperty("samples");

            if (startStr == null)   throw new IllegalArgumentException("Config missing key: start");
            if (endStr == null)     throw new IllegalArgumentException("Config missing key: end");
            if (samplesStr == null) throw new IllegalArgumentException("Config missing key: samples");

            start   = Float.parseFloat(startStr.trim());
            end     = Float.parseFloat(endStr.trim());
            samples = Integer.parseInt(samplesStr.trim());

            if (samples < 2) {
                throw new IllegalArgumentException("samples must be >= 2, got: " + samples);
            }

        } catch (Exception e) {
            listenerError = e;
            // Exit immediately; dispose() will count down the latch
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        // Guard: if an error occurred in create(), stop immediately
        if (listenerError != null) return;

        if (tickCount >= samples) return; // already done, waiting for dispose()

        // Compute t for this sample index
        float t;
        if (tickCount == 0) {
            t = 0.0f;
        } else if (tickCount == samples - 1) {
            t = 1.0f;                         // exact endpoint, no float drift
        } else {
            t = tickCount / (float) (samples - 1);
        }

        float value = interp.apply(start, end, t);
        results.add(value);

        tickCount++;

        if (tickCount == samples) {
            Gdx.app.exit(); // asynchronous: dispose() will be called by the loop
        }
    }

    @Override
    public void dispose() {
        try {
            // Only write output if there was no error and we actually collected samples
            if (listenerError == null && results.size() == samples) {
                writeOutput();
            }
        } catch (Exception e) {
            if (listenerError == null) listenerError = e;
        } finally {
            doneLatch.countDown();
        }
    }

    // -----------------------------------------------------------------------
    // Output writing
    // -----------------------------------------------------------------------
    private void writeOutput() throws IOException {
        StringWriter sw = new StringWriter(samples * 16);
        PrintWriter  pw = new PrintWriter(sw);

        pw.printf("curve=%s%n", curveName);
        pw.printf("samples=%d%n", samples);
        for (float v : results) {
            pw.printf(Locale.ROOT, "%.6f%n", v);
        }
        pw.flush();

        // Write atomically via java.nio (UTF-8, standard line endings already \n on Linux)
        // Replace \r\n with \n to guarantee LF-only output on any OS
        String content = sw.toString().replace("\r\n", "\n");
        Files.write(Paths.get(outputPath),
                    content.getBytes(StandardCharsets.UTF_8));
    }

    // -----------------------------------------------------------------------
    // Entry point
    // -----------------------------------------------------------------------
    public static void main(String[] args) {
        if (args.length != 2) {
            System.err.println("Usage: InterpolationSampler <config-path> <output-path>");
            System.exit(1);
        }

        String configPath = args[0];
        String outputPath = args[1];

        // ---- Pre-flight: validate config before touching libGDX ----
        Properties preProps = new Properties();
        try (InputStream in = Files.newInputStream(Paths.get(configPath))) {
            preProps.load(in);
        } catch (IOException e) {
            System.err.println("Cannot read config file: " + configPath);
            System.err.println(e.getMessage());
            System.exit(1);
        }

        String curvePre = preProps.getProperty("curve", "").trim();
        if (resolveInterpolation(curvePre) == null) {
            System.err.printf("Unknown curve name: \"%s\". Supported: linear, smooth, smoother%n",
                              curvePre);
            System.exit(1);
        }

        // ---- Bootstrap libGDX headless application ----
        CountDownLatch doneLatch = new CountDownLatch(1);
        InterpolationSampler listener =
                new InterpolationSampler(configPath, outputPath, doneLatch);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // 0 = run loop as fast as possible without wall-clock pacing
        config.updatesPerSecond = 0;

        // HeadlessApplication starts a new thread and returns immediately
        HeadlessApplication app = new HeadlessApplication(listener, config);

        // Wait until dispose() has fired and the latch is counted down
        try {
            doneLatch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("Interrupted while waiting for application to finish.");
            System.exit(1);
        }

        // Propagate any error that occurred inside the listener
        if (listener.listenerError != null) {
            System.err.println("Error: " + listener.listenerError.getMessage());
            System.exit(1);
        }
    }
}
