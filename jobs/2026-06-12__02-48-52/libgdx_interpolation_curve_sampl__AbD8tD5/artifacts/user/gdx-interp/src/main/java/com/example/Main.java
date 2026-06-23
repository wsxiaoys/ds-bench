package com.example;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.math.Interpolation;

import java.io.InputStream;
import java.io.PrintWriter;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Properties;

public class Main {
    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: Main <config-path> <output-path>");
            System.exit(1);
        }

        String configPath = args[0];
        String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        final int[] exitCode = {0};

        ApplicationAdapter listener = new ApplicationAdapter() {
            String curveName;
            float start;
            float end;
            int totalSamples;

            int currentSample = 0;
            List<Float> results = new ArrayList<>();
            Interpolation interp;
            boolean error = false;

            @Override
            public void create() {
                try {
                    Properties props = new Properties();
                    try (InputStream is = Gdx.files.absolute(configPath).read()) {
                        props.load(is);
                    }

                    curveName = props.getProperty("curve");
                    if (curveName == null) throw new IllegalArgumentException("Missing curve");
                    
                    String startStr = props.getProperty("start");
                    if (startStr == null) throw new IllegalArgumentException("Missing start");
                    start = Float.parseFloat(startStr);
                    
                    String endStr = props.getProperty("end");
                    if (endStr == null) throw new IllegalArgumentException("Missing end");
                    end = Float.parseFloat(endStr);
                    
                    String samplesStr = props.getProperty("samples");
                    if (samplesStr == null) throw new IllegalArgumentException("Missing samples");
                    totalSamples = Integer.parseInt(samplesStr);

                    if (totalSamples < 2) {
                        throw new IllegalArgumentException("samples must be >= 2");
                    }

                    if ("linear".equals(curveName)) {
                        interp = Interpolation.linear;
                    } else if ("smooth".equals(curveName)) {
                        interp = Interpolation.smooth;
                    } else if ("smoother".equals(curveName)) {
                        interp = Interpolation.smoother;
                    } else {
                        System.err.println("Unsupported curve: " + curveName);
                        error = true;
                        exitCode[0] = 1;
                        Gdx.app.exit();
                        return;
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    error = true;
                    exitCode[0] = 1;
                    Gdx.app.exit();
                }
            }

            @Override
            public void render() {
                if (error) return;
                if (currentSample < totalSamples) {
                    float t = (float) currentSample / (totalSamples - 1);
                    if (currentSample == totalSamples - 1) {
                        t = 1.0f;
                    }
                    float val = interp.apply(start, end, t);
                    results.add(val);
                    currentSample++;

                    if (currentSample >= totalSamples) {
                        Gdx.app.exit();
                    }
                }
            }

            @Override
            public void dispose() {
                if (error) {
                    return;
                }
                try (PrintWriter pw = new PrintWriter(Gdx.files.absolute(outputPath).writer(false, "UTF-8"))) {
                    pw.print("curve=" + curveName + "\n");
                    pw.print("samples=" + totalSamples + "\n");
                    for (float val : results) {
                        pw.print(String.format(Locale.ROOT, "%.6f\n", val));
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    exitCode[0] = 1;
                }
            }
        };

        HeadlessApplication app = new HeadlessApplication(listener, config);

        Field f = HeadlessApplication.class.getDeclaredField("mainLoopThread");
        f.setAccessible(true);
        Thread t = (Thread) f.get(app);
        if (t != null) {
            t.join();
        }

        if (exitCode[0] != 0) {
            System.exit(exitCode[0]);
        }
    }
}
