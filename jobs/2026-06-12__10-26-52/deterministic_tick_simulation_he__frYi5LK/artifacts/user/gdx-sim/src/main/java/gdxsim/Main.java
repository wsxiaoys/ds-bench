package gdxsim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import java.util.Properties;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;

public class Main {
    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: java Main <config-path> <output-path>");
            System.exit(1);
        }
        
        String configPath = args[0];
        String outputPath = args[1];
        
        CountDownLatch latch = new CountDownLatch(1);
        
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;
        
        new HeadlessApplication(new SimAdapter(configPath, outputPath, latch), config);
        
        latch.await();
    }
}

class SimAdapter extends ApplicationAdapter {
    private String configPath;
    private String outputPath;
    private CountDownLatch latch;
    
    private int targetTicks;
    private double dt;
    private double x, y, vx, vy, gravityY;
    private int currentTicks = 0;
    
    public SimAdapter(String configPath, String outputPath, CountDownLatch latch) {
        this.configPath = configPath;
        this.outputPath = outputPath;
        this.latch = latch;
    }
    
    @Override
    public void create() {
        Properties props = new Properties();
        try {
            props.load(Gdx.files.absolute(configPath).reader());
            targetTicks = Integer.parseInt(props.getProperty("ticks", "0"));
            dt = Double.parseDouble(props.getProperty("dt", "0.0"));
            x = Double.parseDouble(props.getProperty("position_x", "0.0"));
            y = Double.parseDouble(props.getProperty("position_y", "0.0"));
            vx = Double.parseDouble(props.getProperty("velocity_x", "0.0"));
            vy = Double.parseDouble(props.getProperty("velocity_y", "0.0"));
            gravityY = Double.parseDouble(props.getProperty("gravity_y", "0.0"));
        } catch (Exception e) {
            e.printStackTrace();
            Gdx.app.exit();
        }
        
        if (targetTicks == 0) {
            Gdx.app.exit();
        }
    }
    
    @Override
    public void render() {
        if (currentTicks < targetTicks) {
            vx += 0 * dt; // ax = 0
            vy += gravityY * dt;
            x += vx * dt;
            y += vy * dt;
            currentTicks++;
            
            if (currentTicks >= targetTicks) {
                Gdx.app.exit();
            }
        }
    }
    
    @Override
    public void dispose() {
        try {
            String out = String.format(Locale.ROOT, "final_x=%.6f\nfinal_y=%.6f\nfinal_vx=%.6f\nfinal_vy=%.6f\nticks=%d\n",
                x, y, vx, vy, currentTicks);
            Gdx.files.absolute(outputPath).writeString(out, false, "UTF-8");
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            latch.countDown();
        }
    }
}
