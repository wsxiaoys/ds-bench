package gdx.interp;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.util.concurrent.CountDownLatch;

public class Main {
    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Error: Missing arguments.");
            System.err.println("Usage: ./gradlew run --args=\"<config-path> <output-path>\"");
            System.exit(1);
        }

        String configPath = args[0];
        String outputPath = args[1];

        CountDownLatch latch = new CountDownLatch(1);
        SamplerListener listener = new SamplerListener(configPath, outputPath, latch);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0; // Run as fast as possible

        try {
            new HeadlessApplication(listener, config);

            // Wait for the ApplicationListener's dispose() to be called and complete
            latch.await();

            // Join the HeadlessApplication main loop thread to ensure clean exit
            joinHeadlessThread();

            // Exit with the code determined by the listener's success or failure
            System.exit(listener.getExitCode());
        } catch (InterruptedException e) {
            System.err.println("Error: Main thread interrupted: " + e.getMessage());
            Thread.currentThread().interrupt();
            System.exit(1);
        } catch (Exception e) {
            System.err.println("Error bootstrapping HeadlessApplication: " + e.getMessage());
            System.exit(1);
        }
    }

    private static void joinHeadlessThread() {
        Thread[] threads = new Thread[Thread.activeCount() * 2];
        int count = Thread.enumerate(threads);
        for (int i = 0; i < count; i++) {
            Thread t = threads[i];
            if (t != null && t.getName().contains("HeadlessApplication")) {
                try {
                    t.join(5000); // Wait up to 5 seconds for the thread to join
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }
    }
}
