package com.gdxsim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.io.BufferedWriter;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;

public class Simulation {

    public static void main(String[] args) throws InterruptedException {
        if (args.length < 2) {
            System.err.println("Usage: Simulation <config-path> <output-path>");
            System.exit(1);
        }

        String configPath = args[0];
        String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        CountDownLatch latch = new CountDownLatch(1);

        SimListener listener = new SimListener(configPath, outputPath, latch);
        HeadlessApplication app = new HeadlessApplication(listener, config);

        // Wait for the simulation to finish (dispose writes output and counts down the latch)
        latch.await();

        // Check for errors during simulation
        if (listener.getError() != null) {
            System.err.println("Simulation failed: " + listener.getError());
            System.exit(1);
        }
    }

    static class SimListener extends ApplicationAdapter {
        private final String configPath;
        private final String outputPath;
        private final CountDownLatch latch;

        private double x, y;
        private double vx, vy;
        private double ax, ay;
        private double dt;
        private int totalTicks;
        private int currentTick;
        private String error;

        SimListener(String configPath, String outputPath, CountDownLatch latch) {
            this.configPath = configPath;
            this.outputPath = outputPath;
            this.latch = latch;
        }

        String getError() {
            return error;
        }

        @Override
        public void create() {
            try {
                Properties props = new Properties();
                props.load(Gdx.files.absolute(configPath).read());

                totalTicks = Integer.parseInt(props.getProperty("ticks"));
                dt = Double.parseDouble(props.getProperty("dt"));
                x = Double.parseDouble(props.getProperty("position_x"));
                y = Double.parseDouble(props.getProperty("position_y"));
                vx = Double.parseDouble(props.getProperty("velocity_x"));
                vy = Double.parseDouble(props.getProperty("velocity_y"));
                ay = Double.parseDouble(props.getProperty("gravity_y"));
                ax = 0.0;

                currentTick = 0;
            } catch (Exception e) {
                error = e.getMessage();
                Gdx.app.exit();
            }
        }

        @Override
        public void render() {
            if (currentTick >= totalTicks) {
                Gdx.app.exit();
                return;
            }

            // Symplectic Euler: update velocity first, then position
            vx += ax * dt;
            vy += ay * dt;
            x += vx * dt;
            y += vy * dt;

            currentTick++;
        }

        @Override
        public void dispose() {
            try (PrintWriter writer = new PrintWriter(
                    new BufferedWriter(
                        new OutputStreamWriter(
                            Gdx.files.absolute(outputPath).write(false),
                            StandardCharsets.UTF_8)))) {
                writer.printf(Locale.ROOT, "final_x=%.6f%n", x);
                writer.printf(Locale.ROOT, "final_y=%.6f%n", y);
                writer.printf(Locale.ROOT, "final_vx=%.6f%n", vx);
                writer.printf(Locale.ROOT, "final_vy=%.6f%n", vy);
                writer.printf(Locale.ROOT, "ticks=%d%n", currentTick);
            } catch (Exception e) {
                error = e.getMessage();
            } finally {
                latch.countDown();
            }
        }
    }
}