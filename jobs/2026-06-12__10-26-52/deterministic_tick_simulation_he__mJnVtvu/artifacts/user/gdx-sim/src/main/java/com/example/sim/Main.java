package com.example.sim;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Entry point.  Usage:
 * <pre>
 *   ./gradlew --no-daemon run --args="&lt;config-path&gt; &lt;output-path&gt;"
 * </pre>
 *
 * <p>The {@link HeadlessApplication} constructor spawns its own main-loop thread.
 * We retrieve that thread and {@code join()} it so that the JVM waits until
 * {@code dispose()} has finished writing the output file before exiting.
 */
public class Main {

    public static void main(String[] args) throws InterruptedException {
        if (args.length != 2) {
            System.err.println("Usage: gdx-sim <config-path> <output-path>");
            System.exit(1);
        }

        String configPath = args[0];
        String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // updatesPerSecond = 0 means the loop runs as fast as possible;
        // wall-clock pacing is disabled so ticks are not throttled.
        config.updatesPerSecond = 0;

        SimulationApp app = new SimulationApp(configPath, outputPath);

        // HeadlessApplication starts its main loop on its own thread.
        // We capture it here (it is the most recently started thread named
        // "HeadlessApplication" or similar, but the safest approach is to
        // grab it before it terminates via the returned Application handle).
        HeadlessApplication headless = new HeadlessApplication(app, config);

        // HeadlessApplication exposes no public accessor for its main-loop thread,
        // so we find it by name from the thread group.
        Thread mainLoopThread = findMainLoopThread();

        if (mainLoopThread != null) {
            mainLoopThread.join();
        }
        // After join(), dispose() has been called and the output file is written.
        // System.exit(0) is implicit - the JVM exits naturally once all
        // non-daemon threads (including main) have finished.
    }

    /**
     * Locates the HeadlessApplication main-loop thread.
     *
     * <p>libGDX names the thread {@code "HeadlessApplication"} (the default
     * {@link Thread} name assigned in the constructor).  We poll briefly to
     * let the thread start before searching, then walk the root {@link ThreadGroup}.
     */
    private static Thread findMainLoopThread() throws InterruptedException {
        // Give the thread a moment to start
        for (int attempt = 0; attempt < 50; attempt++) {
            Thread found = searchThreadByName("HeadlessApplication");
            if (found != null) {
                return found;
            }
            Thread.sleep(10);
        }
        // Fallback: thread may have already finished (ticks=0 case)
        return null;
    }

    private static Thread searchThreadByName(String name) {
        // Walk up to the root ThreadGroup
        ThreadGroup root = Thread.currentThread().getThreadGroup();
        while (root.getParent() != null) {
            root = root.getParent();
        }

        Thread[] threads = new Thread[root.activeCount() + 64];
        int count = root.enumerate(threads, true);
        for (int i = 0; i < count; i++) {
            if (threads[i] != null && name.equals(threads[i].getName())) {
                return threads[i];
            }
        }
        return null;
    }
}
