package sim;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

public class Main {

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: Main <scenario_file>");
            System.exit(1);
        }

        String scenarioPath = args[0];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 60;

        SimulationListener listener = new SimulationListener(scenarioPath);
        HeadlessApplication app = new HeadlessApplication(listener, config);

        // Wait for the headless main loop thread to finish
        // The headless application runs on a thread named "HeadlessApplication"
        Thread appThread = null;
        for (Thread t : Thread.getAllStackTraces().keySet()) {
            if (t.getName().equals("HeadlessApplication")) {
                appThread = t;
                break;
            }
        }

        if (appThread != null) {
            try {
                appThread.join();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }
}