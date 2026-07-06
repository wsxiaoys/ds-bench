package com.gdx.sim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Properties;

public class SimulationListener extends ApplicationAdapter {
    private final String configPath;
    private final String outputPath;

    private int totalTicks;
    private int currentTick = 0;
    private double dt;
    private double x;
    private double y;
    private double vx;
    private double vy;
    private double gravityY;

    public SimulationListener(String configPath, String outputPath) {
        // Convert to absolute paths using standard Java File to ensure Gdx.files.absolute works correctly
        this.configPath = new File(configPath).getAbsolutePath();
        this.outputPath = new File(outputPath).getAbsolutePath();
    }

    @Override
    public void create() {
        try {
            Properties props = new Properties();
            try (InputStream in = Gdx.files.absolute(configPath).read()) {
                props.load(in);
            }

            totalTicks = Integer.parseInt(props.getProperty("ticks").trim());
            dt = Double.parseDouble(props.getProperty("dt").trim());
            x = Double.parseDouble(props.getProperty("position_x").trim());
            y = Double.parseDouble(props.getProperty("position_y").trim());
            vx = Double.parseDouble(props.getProperty("velocity_x").trim());
            vy = Double.parseDouble(props.getProperty("velocity_y").trim());
            gravityY = Double.parseDouble(props.getProperty("gravity_y").trim());
        } catch (Exception e) {
            System.err.println("Error loading configuration: " + e.getMessage());
            e.printStackTrace();
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        if (currentTick >= totalTicks) {
            Gdx.app.exit();
            return;
        }

        // Symplectic Euler integration step:
        // vx is updated before x is updated using the new vx
        // vy is updated before y is updated using the new vy
        vx += 0.0 * dt; // ax = 0
        vy += gravityY * dt;
        x += vx * dt;
        y += vy * dt;

        currentTick++;

        if (currentTick >= totalTicks) {
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(
                Gdx.files.absolute(outputPath).write(false), StandardCharsets.UTF_8))) {
            // Write using LF line endings specifically (\n)
            writer.write(String.format(Locale.ROOT, "final_x=%.6f\n", x));
            writer.write(String.format(Locale.ROOT, "final_y=%.6f\n", y));
            writer.write(String.format(Locale.ROOT, "final_vx=%.6f\n", vx));
            writer.write(String.format(Locale.ROOT, "final_vy=%.6f\n", vy));
            writer.write(String.format(Locale.ROOT, "ticks=%d\n", currentTick));
        } catch (Exception e) {
            System.err.println("Error writing output file: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
