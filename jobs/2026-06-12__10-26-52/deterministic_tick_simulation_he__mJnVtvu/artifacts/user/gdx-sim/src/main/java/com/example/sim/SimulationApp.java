package com.example.sim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;

import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Properties;

/**
 * Deterministic tick-based 2D point-mass simulation using Symplectic Euler integration.
 *
 * <p>Integration per tick (velocity updated before position):
 * <pre>
 *   vx += ax * dt       (ax = 0)
 *   vy += ay * dt       (ay = gravity_y)
 *   x  += vx * dt
 *   y  += vy * dt
 * </pre>
 */
public class SimulationApp extends ApplicationAdapter {

    private final String configPath;
    private final String outputPath;

    // Simulation state
    private double x;
    private double y;
    private double vx;
    private double vy;
    private double gravityY;
    private double dt;
    private int totalTicks;
    private int tickCount;

    public SimulationApp(String configPath, String outputPath) {
        this.configPath = configPath;
        this.outputPath = outputPath;
    }

    @Override
    public void create() {
        Properties props = new Properties();
        try (InputStream in = Gdx.files.absolute(configPath).read()) {
            props.load(in);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read config: " + configPath, e);
        }

        totalTicks = Integer.parseInt(props.getProperty("ticks").trim());
        dt         = Double.parseDouble(props.getProperty("dt").trim());
        x          = Double.parseDouble(props.getProperty("position_x").trim());
        y          = Double.parseDouble(props.getProperty("position_y").trim());
        vx         = Double.parseDouble(props.getProperty("velocity_x").trim());
        vy         = Double.parseDouble(props.getProperty("velocity_y").trim());
        gravityY   = Double.parseDouble(props.getProperty("gravity_y").trim());

        tickCount = 0;

        // If zero ticks requested, exit immediately (dispose will write output)
        if (totalTicks == 0) {
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        if (tickCount >= totalTicks) {
            // Should not reach here after exit() is posted, but guard defensively
            return;
        }

        // Symplectic Euler: velocity first, then position
        // ax = 0, ay = gravity_y
        vx += 0.0 * dt;          // ax = 0
        vy += gravityY * dt;
        x  += vx * dt;
        y  += vy * dt;

        tickCount++;

        if (tickCount >= totalTicks) {
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        writeOutput();
    }

    private void writeOutput() {
        String content = String.format(Locale.ROOT,
                "final_x=%.6f%n" +
                "final_y=%.6f%n" +
                "final_vx=%.6f%n" +
                "final_vy=%.6f%n" +
                "ticks=%d%n",
                x, y, vx, vy, tickCount);

        // Normalise to LF line endings
        content = content.replace("\r\n", "\n").replace("\r", "\n");

        try (Writer writer = new OutputStreamWriter(
                new FileOutputStream(outputPath), StandardCharsets.UTF_8)) {
            writer.write(content);
        } catch (IOException e) {
            throw new RuntimeException("Failed to write output: " + outputPath, e);
        }
    }
}
