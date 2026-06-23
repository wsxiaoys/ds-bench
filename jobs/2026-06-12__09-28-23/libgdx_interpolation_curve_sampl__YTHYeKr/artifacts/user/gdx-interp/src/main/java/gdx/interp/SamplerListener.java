package gdx.interp;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.Interpolation;

import java.io.InputStream;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;

public class SamplerListener extends ApplicationAdapter {
    private final String configPath;
    private final String outputPath;
    private final CountDownLatch latch;

    private boolean valid = true;
    private int exitCode = 0;

    private String curve;
    private double start;
    private double end;
    private int samples;

    private Interpolation interpolation;
    private List<Float> samplesList;
    private int tickCount = 0;

    public SamplerListener(String configPath, String outputPath, CountDownLatch latch) {
        this.configPath = configPath;
        this.outputPath = outputPath;
        this.latch = latch;
        this.samplesList = new ArrayList<>();
    }

    public int getExitCode() {
        return exitCode;
    }

    @Override
    public void create() {
        try {
            // Read properties file using Gdx.files.absolute
            Properties props = new Properties();
            try (InputStream in = Gdx.files.absolute(configPath).read()) {
                props.load(in);
            } catch (Exception e) {
                System.err.println("Error: Failed to read config file at " + configPath + ": " + e.getMessage());
                valid = false;
                exitCode = 1;
                Gdx.app.exit();
                return;
            }

            String curveStr = props.getProperty("curve");
            String startStr = props.getProperty("start");
            String endStr = props.getProperty("end");
            String samplesStr = props.getProperty("samples");

            if (curveStr == null || startStr == null || endStr == null || samplesStr == null) {
                System.err.println("Error: Missing required configuration keys (curve, start, end, samples).");
                valid = false;
                exitCode = 1;
                Gdx.app.exit();
                return;
            }

            curve = curveStr.trim();
            // Validate curve name strictly
            if (!"linear".equals(curve) && !"smooth".equals(curve) && !"smoother".equals(curve)) {
                System.err.println("Error: Unsupported curve name: " + curve);
                valid = false;
                exitCode = 1;
                Gdx.app.exit();
                return;
            }

            try {
                start = Double.parseDouble(startStr.trim());
                end = Double.parseDouble(endStr.trim());
            } catch (NumberFormatException e) {
                System.err.println("Error: Invalid double format for start or end.");
                valid = false;
                exitCode = 1;
                Gdx.app.exit();
                return;
            }

            try {
                samples = Integer.parseInt(samplesStr.trim());
            } catch (NumberFormatException e) {
                System.err.println("Error: Invalid integer format for samples.");
                valid = false;
                exitCode = 1;
                Gdx.app.exit();
                return;
            }

            if (samples < 2) {
                System.err.println("Error: samples must be >= 2.");
                valid = false;
                exitCode = 1;
                Gdx.app.exit();
                return;
            }

            // Look up the curve name on com.badlogic.gdx.math.Interpolation using reflection
            try {
                Field field = Interpolation.class.getField(curve);
                interpolation = (Interpolation) field.get(null);
            } catch (NoSuchFieldException | IllegalAccessException e) {
                System.err.println("Error: Failed to look up curve field '" + curve + "' on Interpolation class: " + e.getMessage());
                valid = false;
                exitCode = 1;
                Gdx.app.exit();
                return;
            }

            if (interpolation == null) {
                System.err.println("Error: Interpolation curve '" + curve + "' resolved to null.");
                valid = false;
                exitCode = 1;
                Gdx.app.exit();
                return;
            }

        } catch (Throwable t) {
            System.err.println("Error during initialization: " + t.getMessage());
            t.printStackTrace(System.err);
            valid = false;
            exitCode = 1;
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        try {
            if (!valid) {
                return;
            }

            if (tickCount < samples) {
                float t;
                if (tickCount == samples - 1) {
                    t = 1.0f;
                } else {
                    t = tickCount / (float) (samples - 1);
                }

                float sample = interpolation.apply((float) start, (float) end, t);
                samplesList.add(sample);
                tickCount++;

                if (tickCount == samples) {
                    Gdx.app.exit();
                }
            }
        } catch (Throwable t) {
            System.err.println("Error during render tick: " + t.getMessage());
            t.printStackTrace(System.err);
            valid = false;
            exitCode = 1;
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        try {
            if (valid) {
                StringBuilder sb = new StringBuilder();
                sb.append("curve=").append(curve).append("\n");
                sb.append("samples=").append(samples).append("\n");
                for (float s : samplesList) {
                    sb.append(String.format(Locale.ROOT, "%.6f", s)).append("\n");
                }

                // Write the final result to the output file using Gdx.files.absolute
                Gdx.files.absolute(outputPath).writeString(sb.toString(), false, "UTF-8");
            }
        } catch (Throwable t) {
            System.err.println("Error during dispose and output writing: " + t.getMessage());
            t.printStackTrace(System.err);
            exitCode = 1;
        } finally {
            latch.countDown();
        }
    }
}
