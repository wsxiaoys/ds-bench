package com.example.gdxsim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;

import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Properties;

/**
 * A fully deterministic 2D point-mass simulation driven by the libGDX headless
 * backend. One call to {@link #render()} advances exactly one simulation tick
 * using a fixed time step read from the configuration file. The final state is
 * written to the output file from {@link #dispose()} so it is guaranteed to be
 * flushed before the JVM exits.
 */
public class SimListener extends ApplicationAdapter {

    private final String configPath;
    private final String outputPath;

    // Simulation parameters (parsed from config).
    private int ticks;
    private double dt;
    private double x, y;
    private double vx, vy;
    private double ay;

    // Number of ticks performed so far.
    private int tickCount;

    // Ensures Gdx.app.exit() is requested at most once.
    private boolean exitRequested;

    public SimListener(String configPath, String outputPath) {
        this.configPath = configPath;
        this.outputPath = outputPath;
    }

    @Override
    public void create() {
        FileHandle handle = Gdx.files.absolute(configPath);
        Properties props = new Properties();
        try (var in = handle.read()) {
            props.load(in);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read config file: " + configPath, e);
        }

        ticks = Integer.parseInt(getProp(props, "ticks"));
        dt = Double.parseDouble(getProp(props, "dt"));
        x = Double.parseDouble(getProp(props, "position_x"));
        y = Double.parseDouble(getProp(props, "position_y"));
        vx = Double.parseDouble(getProp(props, "velocity_x"));
        vy = Double.parseDouble(getProp(props, "velocity_y"));
        ay = Double.parseDouble(getProp(props, "gravity_y"));

        if (ticks < 0) {
            throw new IllegalArgumentException("ticks must be >= 0");
        }

        tickCount = 0;
        exitRequested = false;
    }

    private static String getProp(Properties props, String key) {
        String value = props.getProperty(key);
        if (value == null) {
            throw new IllegalArgumentException("Missing required config key: " + key);
        }
        return value.trim();
    }

    @Override
    public void render() {
        if (tickCount >= ticks) {
            requestExitOnce();
            return;
        }

        // Symplectic Euler: update velocity first, then position using new velocity.
        double ax = 0.0;
        vx += ax * dt;
        vy += ay * dt;
        x += vx * dt;
        y += vy * dt;

        tickCount++;

        if (tickCount >= ticks) {
            requestExitOnce();
        }
    }

    private void requestExitOnce() {
        if (!exitRequested) {
            exitRequested = true;
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        String output = String.format(Locale.ROOT,
                "final_x=%.6f%n" +
                "final_y=%.6f%n" +
                "final_vx=%.6f%n" +
                "final_vy=%.6f%n" +
                "ticks=%d%n",
                x, y, vx, vy, tickCount);

        FileHandle out = Gdx.files.absolute(outputPath);
        try (OutputStream os = out.write(false);
             Writer writer = new OutputStreamWriter(os, StandardCharsets.UTF_8)) {
            writer.write(output);
        } catch (IOException e) {
            throw new RuntimeException("Failed to write output file: " + outputPath, e);
        }
    }
}