package com.sim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import java.io.IOException;
import java.util.Locale;
import java.util.Properties;

public class SimulationListener extends ApplicationAdapter {
    private final String configPath;
    private final String outputPath;

    private int ticks;
    private double dt;
    private double x;
    private double y;
    private double vx;
    private double vy;
    private double gravity_y;

    private int currentTick = 0;

    public SimulationListener(String configPath, String outputPath) {
        this.configPath = configPath;
        this.outputPath = outputPath;
    }

    @Override
    public void create() {
        try {
            Properties props = new Properties();
            props.load(Gdx.files.absolute(configPath).read());

            ticks = Integer.parseInt(props.getProperty("ticks").trim());
            dt = Double.parseDouble(props.getProperty("dt").trim());
            x = Double.parseDouble(props.getProperty("position_x").trim());
            y = Double.parseDouble(props.getProperty("position_y").trim());
            vx = Double.parseDouble(props.getProperty("velocity_x").trim());
            vy = Double.parseDouble(props.getProperty("velocity_y").trim());
            gravity_y = Double.parseDouble(props.getProperty("gravity_y").trim());
        } catch (Exception e) {
            e.printStackTrace();
            Gdx.app.exit();
            return;
        }

        if (ticks == 0) {
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        if (currentTick < ticks) {
            // Symplectic Euler integration:
            // vx += ax * dt  (ax = 0)
            // vy += ay * dt  (ay = gravity_y)
            // x  += vx * dt
            // y  += vy * dt
            vx += 0.0 * dt;
            vy += gravity_y * dt;
            x += vx * dt;
            y += vy * dt;

            currentTick++;
        }

        if (currentTick == ticks) {
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        try {
            String output = String.format(Locale.ROOT,
                "final_x=%.6f\nfinal_y=%.6f\nfinal_vx=%.6f\nfinal_vy=%.6f\nticks=%d\n",
                x, y, vx, vy, ticks
            );
            Gdx.files.absolute(outputPath).writeString(output, false, "UTF-8");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
