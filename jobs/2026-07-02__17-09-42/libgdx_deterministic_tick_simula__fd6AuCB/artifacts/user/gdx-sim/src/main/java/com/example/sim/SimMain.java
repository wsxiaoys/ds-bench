package com.example.sim;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Properties;

/**
 * Deterministic tick-based 2D point-mass simulation running on libGDX's
 * headless backend. The simulation is driven by a fixed {@code dt} read from
 * the configuration file (NOT {@code Gdx.graphics.getDeltaTime()}) so that the
 * result is reproducible and independent of wall-clock time.
 */
public class SimMain {

    public static void main(String[] args) throws InterruptedException {
        if (args.length < 2) {
            System.err.println("Usage: SimMain <config-path> <output-path>");
            System.exit(1);
        }

        String configPath = args[0];
        String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Run the main loop as fast as possible; we drive ticks from the
        // configuration's dt, not from wall-clock time.
        config.updatesPerSecond = 0;

        // Build the application. After Gdx.app.exit() is called from the
        // listener, the loop sees the running flag flip, invokes pause() +
        // dispose() (which writes the output file), and then the main
        // loop thread terminates. Joining on that thread is the cleanest
        // way to guarantee the file is flushed before the JVM exits.
        SimApplication app = new SimApplication(
                new SimListener(configPath, outputPath), config);
        app.getMainLoopThread().join();
    }

    /**
     * Tiny {@link HeadlessApplication} subclass that exposes the protected
     * {@code mainLoopThread} field. libGDX does not provide a public
     * accessor for it, so we need a subclass to surface it for {@code join()}.
     */
    private static final class SimApplication extends HeadlessApplication {
        SimApplication(ApplicationListener listener,
                       HeadlessApplicationConfiguration config) {
            super(listener, config);
        }

        Thread getMainLoopThread() {
            return this.mainLoopThread;
        }
    }

    /**
     * The {@link ApplicationListener} that performs the simulation.
     * <p>
     * Lifecycle:
     * <ul>
     *   <li>{@link #create()} reads the configuration from disk.</li>
     *   <li>{@link #render()} advances exactly one simulation tick. After
     *       the configured number of ticks, it requests exit.</li>
     *   <li>{@link #dispose()} writes the final state to the output file.</li>
     * </ul>
     */
    private static final class SimListener implements ApplicationListener {

        private final String configPath;
        private final String outputPath;

        // Simulation state.
        private int ticks;
        private double dt;
        private double x;
        private double y;
        private double vx;
        private double vy;
        private double gravityY;

        // Number of render() invocations that have performed an integration
        // step. Each call to render() advances the simulation by exactly one
        // tick while ticksExecuted < ticks; once we reach the requested tick
        // count, render() stops integrating and calls Gdx.app.exit().
        private int ticksExecuted;
        private boolean initialized;

        SimListener(String configPath, String outputPath) {
            this.configPath = configPath;
            this.outputPath = outputPath;
        }

        @Override
        public void create() {
            try {
                loadConfig();
            } catch (IOException e) {
                throw new RuntimeException("Failed to load config: " + configPath, e);
            }
            initialized = true;
        }

        private void loadConfig() throws IOException {
            // Use libGDX's FileHandle so that the path is interpreted the
            // same way libGDX would interpret it anywhere else.
            FileHandle handle = Gdx.files.absolute(configPath);
            Properties props = new Properties();
            props.load(handle.read());

            this.ticks = Integer.parseInt(props.getProperty("ticks", "0").trim());
            this.dt = Double.parseDouble(props.getProperty("dt", "0.0").trim());
            this.x = Double.parseDouble(props.getProperty("position_x", "0.0").trim());
            this.y = Double.parseDouble(props.getProperty("position_y", "0.0").trim());
            this.vx = Double.parseDouble(props.getProperty("velocity_x", "0.0").trim());
            this.vy = Double.parseDouble(props.getProperty("velocity_y", "0.0").trim());
            this.gravityY = Double.parseDouble(props.getProperty("gravity_y", "0.0").trim());

            if (this.ticks < 0) {
                throw new IllegalArgumentException("ticks must be >= 0, got " + this.ticks);
            }
        }

        @Override
        public void render() {
            if (!initialized) {
                // Should not happen, but guard just in case create() was
                // somehow not called.
                return;
            }

            if (ticksExecuted < ticks) {
                // Symplectic Euler: update velocity first, then position
                // using the new velocity. Constant acceleration (ax=0,
                // ay=gravity_y) is taken straight from the config.
                vx += 0.0 * dt;
                vy += gravityY * dt;
                x += vx * dt;
                y += vy * dt;
                ticksExecuted++;
            }

            if (ticksExecuted >= ticks) {
                // Done -- request exit. The main loop will run pause()
                // and dispose() on us next.
                Gdx.app.exit();
            }
        }

        @Override
        public void dispose() {
            try {
                writeOutput();
            } catch (IOException e) {
                throw new RuntimeException("Failed to write output: " + outputPath, e);
            }
        }

        private void writeOutput() throws IOException {
            // Ensure parent directory exists.
            Path out = Paths.get(outputPath);
            Path parent = out.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }

            // UTF-8 with LF line endings. We use a plain NIO output stream
            // for explicit control over the line separator; '\n' on the
            // StringBuilder is what guarantees LF only.
            StringBuilder sb = new StringBuilder();
            sb.append("final_x=").append(format(x)).append('\n');
            sb.append("final_y=").append(format(y)).append('\n');
            sb.append("final_vx=").append(format(vx)).append('\n');
            sb.append("final_vy=").append(format(vy)).append('\n');
            sb.append("ticks=").append(ticksExecuted).append('\n');

            try (BufferedWriter writer = new BufferedWriter(
                    new OutputStreamWriter(Files.newOutputStream(out),
                            StandardCharsets.UTF_8))) {
                writer.write(sb.toString());
            }
        }

        private static String format(double value) {
            return String.format(Locale.ROOT, "%.6f", value);
        }

        @Override
        public void pause() {
            // No-op: nothing to pause in a headless simulation.
        }

        @Override
        public void resume() {
            // No-op.
        }

        @Override
        public void resize(int width, int height) {
            // No-op: the headless backend has no real window to resize.
        }
    }
}
