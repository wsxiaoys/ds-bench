package com.example.gdxsim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Objects;
import java.util.Properties;

public final class SimulationMain {
    private SimulationMain() {
    }

    public static void main(String[] args) throws InterruptedException {
        if (args.length != 2) {
            System.err.println("Usage: ./gradlew run --args=\"<config-path> <output-path>\"");
            System.exit(2);
        }

        HeadlessApplicationConfiguration configuration = new HeadlessApplicationConfiguration();
        configuration.updatesPerSecond = 0;

        DeterministicSimulation simulation = new DeterministicSimulation(args[0], args[1]);
        HeadlessApplication application = new HeadlessApplication(simulation, configuration);
        findMainLoopThread(application).join();
    }

    private static Thread findMainLoopThread(HeadlessApplication application) {
        Class<?> currentType = application.getClass();
        while (currentType != null) {
            try {
                Field field = currentType.getDeclaredField("mainLoopThread");
                field.setAccessible(true);
                Object value = field.get(application);
                if (value instanceof Thread thread) {
                    return thread;
                }
                throw new IllegalStateException("HeadlessApplication mainLoopThread field is not a Thread");
            } catch (NoSuchFieldException ignored) {
                currentType = currentType.getSuperclass();
            } catch (IllegalAccessException e) {
                throw new IllegalStateException("Unable to access HeadlessApplication main loop thread", e);
            }
        }
        throw new IllegalStateException("Unable to locate HeadlessApplication main loop thread");
    }

    private static final class DeterministicSimulation extends ApplicationAdapter {
        private final String configPath;
        private final String outputPath;

        private int configuredTicks;
        private int completedTicks;
        private double dt;
        private double x;
        private double y;
        private double vx;
        private double vy;
        private double gravityY;

        private DeterministicSimulation(String configPath, String outputPath) {
            this.configPath = Objects.requireNonNull(configPath, "configPath");
            this.outputPath = Objects.requireNonNull(outputPath, "outputPath");
        }

        @Override
        public void create() {
            Properties properties = new Properties();
            FileHandle configFile = Gdx.files.absolute(configPath);
            try (InputStream input = configFile.read()) {
                properties.load(input);
            } catch (IOException e) {
                throw new IllegalStateException("Failed to read simulation config: " + configPath, e);
            }

            configuredTicks = parseTicks(properties);
            dt = parseDouble(properties, "dt");
            x = parseDouble(properties, "position_x");
            y = parseDouble(properties, "position_y");
            vx = parseDouble(properties, "velocity_x");
            vy = parseDouble(properties, "velocity_y");
            gravityY = parseDouble(properties, "gravity_y");

            if (configuredTicks == 0) {
                Gdx.app.exit();
            }
        }

        @Override
        public void render() {
            if (completedTicks >= configuredTicks) {
                return;
            }

            vx += 0.0d * dt;
            vy += gravityY * dt;
            x += vx * dt;
            y += vy * dt;
            completedTicks++;

            if (completedTicks == configuredTicks) {
                Gdx.app.exit();
            }
        }

        @Override
        public void dispose() {
            String output = String.format(
                    Locale.ROOT,
                    "final_x=%.6f%nfinal_y=%.6f%nfinal_vx=%.6f%nfinal_vy=%.6f%nticks=%d%n",
                    x,
                    y,
                    vx,
                    vy,
                    completedTicks
            ).replace(System.lineSeparator(), "\n");

            FileHandle outputFile = Gdx.files.absolute(outputPath);
            try (OutputStream stream = outputFile.write(false)) {
                stream.write(output.getBytes(StandardCharsets.UTF_8));
                stream.flush();
            } catch (IOException e) {
                throw new IllegalStateException("Failed to write simulation output: " + outputPath, e);
            }
        }

        private static int parseTicks(Properties properties) {
            String value = requiredProperty(properties, "ticks");
            int ticks;
            try {
                ticks = Integer.parseInt(value.trim());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Property 'ticks' must be an integer", e);
            }
            if (ticks < 0) {
                throw new IllegalArgumentException("Property 'ticks' must be >= 0");
            }
            return ticks;
        }

        private static double parseDouble(Properties properties, String key) {
            String value = requiredProperty(properties, key);
            try {
                return Double.parseDouble(value.trim());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Property '" + key + "' must be a double", e);
            }
        }

        private static String requiredProperty(Properties properties, String key) {
            String value = properties.getProperty(key);
            if (value == null) {
                throw new IllegalArgumentException("Missing required property: " + key);
            }
            return value;
        }
    }
}
