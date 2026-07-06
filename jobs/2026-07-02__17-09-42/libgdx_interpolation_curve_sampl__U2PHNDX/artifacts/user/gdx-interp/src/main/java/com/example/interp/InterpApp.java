package com.example.interp;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.math.Interpolation;

import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.Reader;
import java.io.Writer;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;

/**
 * ApplicationListener that samples a named libGDX {@link Interpolation} curve
 * over the unit interval using a properties-file configuration, and writes the
 * samples to an output file.
 *
 * <p>The application is meant to run on the libGDX headless backend and exits
 * deterministically after producing exactly {@code samples} samples.</p>
 */
public class InterpApp extends ApplicationAdapter {

    private final String configPath;
    private final String outputPath;
    private final CountDownLatch doneLatch = new CountDownLatch(1);

    // Configuration, populated in create().
    private String curveName;
    private double start;
    private double end;
    private int samples;

    // Runtime state.
    private Interpolation interpolation;
    private int currentIndex;

    // Error handling.
    private volatile boolean error;
    private volatile int exitCode;

    // Buffered samples written during render().
    private final StringBuilder samplesBuffer = new StringBuilder();

    public InterpApp(String configPath, String outputPath) {
        this.configPath = configPath;
        this.outputPath = outputPath;
    }

    /**
     * Waits until the application has fully shut down (i.e. {@link #dispose()}
     * has finished running).
     */
    public void awaitTermination() throws InterruptedException {
        doneLatch.await();
    }

    /**
     * @return the exit code to propagate to the JVM. {@code 0} means success.
     */
    public int getExitCode() {
        return exitCode;
    }

    @Override
    public void create() {
        try {
            Properties props = new Properties();
            FileHandle fh = Gdx.files.absolute(configPath);
            try (Reader r = fh.reader("UTF-8")) {
                props.load(r);
            }

            String cName = props.getProperty("curve");
            if (cName == null || cName.isEmpty()) {
                fail("Missing 'curve' property in " + configPath);
                return;
            }
            String sStart = props.getProperty("start");
            if (sStart == null) {
                fail("Missing 'start' property in " + configPath);
                return;
            }
            String sEnd = props.getProperty("end");
            if (sEnd == null) {
                fail("Missing 'end' property in " + configPath);
                return;
            }
            String sSamples = props.getProperty("samples");
            if (sSamples == null) {
                fail("Missing 'samples' property in " + configPath);
                return;
            }

            double sVal;
            double eVal;
            int nVal;
            try {
                sVal = Double.parseDouble(sStart);
            } catch (NumberFormatException nfe) {
                fail("Invalid 'start' value: " + sStart);
                return;
            }
            try {
                eVal = Double.parseDouble(sEnd);
            } catch (NumberFormatException nfe) {
                fail("Invalid 'end' value: " + sEnd);
                return;
            }
            try {
                nVal = Integer.parseInt(sSamples);
            } catch (NumberFormatException nfe) {
                fail("Invalid 'samples' value: " + sSamples);
                return;
            }

            if (nVal < 2) {
                fail("'samples' must be >= 2, got " + nVal);
                return;
            }

            Field field;
            try {
                field = Interpolation.class.getField(cName);
            } catch (NoSuchFieldException ex) {
                fail("Unknown curve: " + cName);
                return;
            }

            Object value;
            try {
                value = field.get(null);
            } catch (IllegalAccessException ex) {
                fail("Cannot access curve field: " + cName);
                return;
            }

            if (!(value instanceof Interpolation)) {
                fail("Curve field '" + cName + "' is not an Interpolation");
                return;
            }

            this.curveName = cName;
            this.start = sVal;
            this.end = eVal;
            this.samples = nVal;
            this.interpolation = (Interpolation) value;
            this.currentIndex = 0;

        } catch (IOException ex) {
            fail("Failed to read config file '" + configPath + "': " + ex.getMessage());
        } catch (Exception ex) {
            fail("Unexpected error reading config: " + ex.getMessage());
        }
    }

    /**
     * Marks the application as failed, prints an error to stderr, releases the
     * latch so {@code main()} can exit, and requests the application loop to
     * stop.
     */
    private void fail(String message) {
        if (error) {
            // Avoid double-counting the latch.
            return;
        }
        System.err.println(message);
        error = true;
        exitCode = 1;
        doneLatch.countDown();
        Gdx.app.exit();
    }

    @Override
    public void render() {
        // The libGDX main loop processes exit() runnables BEFORE the next
        // render() call, but the loop structure (check running -> execute
        // runnables -> render) means render() may still be invoked once more
        // after exit() has been called. Guard against producing samples past
        // the requested count.
        if (error || interpolation == null || currentIndex >= samples) {
            return;
        }

        // Ensure the final sample lands exactly at t = 1.0.
        float t;
        if (currentIndex == samples - 1) {
            t = 1.0f;
        } else {
            t = currentIndex / (float) (samples - 1);
        }

        float result = interpolation.apply((float) start, (float) end, t);
        samplesBuffer.append(String.format(Locale.ROOT, "%.6f", result)).append('\n');

        currentIndex++;

        if (currentIndex >= samples) {
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        try {
            if (error || interpolation == null) {
                // Spec: do NOT create or overwrite the output file on failure.
                return;
            }

            try (Writer w = new OutputStreamWriter(
                    new FileOutputStream(outputPath), StandardCharsets.UTF_8)) {
                w.write("curve=" + curveName + "\n");
                w.write("samples=" + samples + "\n");
                w.write(samplesBuffer.toString());
            }
        } catch (IOException ex) {
            System.err.println("Failed to write output file '" + outputPath + "': " + ex.getMessage());
            exitCode = 1;
        } finally {
            doneLatch.countDown();
        }
    }
}