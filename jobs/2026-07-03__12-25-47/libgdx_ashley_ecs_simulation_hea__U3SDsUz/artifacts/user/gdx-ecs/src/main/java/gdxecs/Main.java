package gdxecs;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.lang.reflect.Field;
import java.util.Map;

/**
 * Command-line entry point.  Boots the headless libGDX application, waits for
 * the headless main-loop thread to terminate (so all simulation output has been
 * flushed), then returns exit status 0.
 */
public final class Main {

    private Main() { }

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: gdx-ecs <scenario-file>");
            System.exit(2);
        }
        String scenarioPath = args[0];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Drive the headless main loop at exactly 60 ticks/second; each tick
        // corresponds to one render() invocation, which advances the ECS by
        // 1/60s.
        config.updatesPerSecond = 60;
        // We don't want any rendering/audio clutter, but most fields on the
        // configuration have safe defaults so we leave them alone.

        HeadlessApplication app = new HeadlessApplication(new GdxEcsSimulator(scenarioPath), config);

        Thread loopThread = extractMainLoopThread(app);
        try {
            // The simulator calls Gdx.app.exit() once TICKS updates have been
            // dispatched; that schedules running=false on the main loop thread
            // and the thread will terminate shortly after.
            loopThread.join();
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            System.err.println("Interrupted while waiting for headless main loop");
            System.exit(3);
        }
        System.exit(0);
    }

    /**
     * Reflectively grab the headless application's main-loop thread.  We try a
     * known field name first; if that fails we fall back to scanning all live
     * threads for one whose name is exactly {@code HeadlessApplication}.  Both
     * approaches are documented in the task description.
     */
    private static Thread extractMainLoopThread(HeadlessApplication app) {
        Class<?> c = app.getClass();
        // Look for any field assignable to Thread; the field in 1.13.x is
        // named "runnables" for the queue and "thread" for the actual loop
        // thread, but we don't want to depend on names.  Try common ones.
        for (String fieldName : new String[] { "thread", "mainLoopThread", "runnable", "loopThread" }) {
            try {
                Field f = c.getDeclaredField(fieldName);
                f.setAccessible(true);
                Object value = f.get(app);
                if (value instanceof Thread) {
                    return (Thread) value;
                }
            } catch (NoSuchFieldException ignored) {
                // try next name
            } catch (IllegalAccessException iae) {
                // try next name
            }
        }
        // Fallback: hunt through live threads.
        Map<Thread, StackTraceElement[]> traces = Thread.getAllStackTraces();
        for (Thread t : traces.keySet()) {
            if ("HeadlessApplication".equals(t.getName())) {
                return t;
            }
        }
        throw new IllegalStateException("Could not locate the headless main loop thread");
    }
}
