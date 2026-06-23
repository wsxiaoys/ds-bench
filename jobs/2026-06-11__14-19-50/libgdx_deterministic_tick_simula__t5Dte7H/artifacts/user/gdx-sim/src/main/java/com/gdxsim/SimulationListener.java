package com.gdxsim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;

import java.io.*;
import java.util.Locale;
import java.util.Properties;

public class SimulationListener extends ApplicationAdapter {

    private final String configPath;
    private final String outputPath;

    // Config values
    private int ticks;
    private double dt;
    private double gravityY;

    // Simulation state
    private double x, y;
    private double vx, vy;
    private int tickCount;

    public SimulationListener(String configPath, String outputPath) {
        this.configPath = configPath;
        this.outputPath = outputPath;
    }

    @Override
    public void create() {
        // Read config via Gdx.files.absolute
        FileHandle configFile = Gdx.files.absolute(configPath);
        Properties props = new Properties();
        try (Reader reader = configFile.reader("UTF-8")) {
            props.load(reader);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read config file: " + configPath, e);
        }

        ticks = Integer.parseInt(props.getProperty("ticks"));
        dt = Double.parseDouble(props.getProperty("dt"));
        x = Double.parseDouble(props.getProperty("position_x"));
        y = Double.parseDouble(props.getProperty("position_y"));
        vx = Double.parseDouble(props.getProperty("velocity_x"));
        vy = Double.parseDouble(props.getProperty("velocity_y"));
        gravityY = Double.parseDouble(props.getProperty("gravity_y"));

        tickCount = 0;
    }

    @Override
    public void render() {
        if (tickCount >= ticks) {
            Gdx.app.exit();
            return;
        }

        // Symplectic Euler integration: update velocity first, then position
        // ax = 0, ay = gravityY
        vx += 0 * dt;       // ax = 0
        vy += gravityY * dt;
        x += vx * dt;
        y += vy * dt;

        tickCount++;
    }

    @Override
    public void dispose() {
        // Write final state to output file
        FileHandle outputFile = Gdx.files.absolute(outputPath);
        try (Writer writer = outputFile.writer(false, "UTF-8")) {
            writer.write(String.format(Locale.ROOT, "final_x=%.6f%n", x));
            writer.write(String.format(Locale.ROOT, "final_y=%.6f%n", y));
            writer.write(String.format(Locale.ROOT, "final_vx=%.6f%n", vx));
            writer.write(String.format(Locale.ROOT, "final_vy=%.6f%n", vy));
            writer.write(String.format(Locale.ROOT, "ticks=%d%n", tickCount));
            writer.flush();
        } catch (IOException e) {
            throw new RuntimeException("Failed to write output file: " + outputPath, e);
        }
    }
}
