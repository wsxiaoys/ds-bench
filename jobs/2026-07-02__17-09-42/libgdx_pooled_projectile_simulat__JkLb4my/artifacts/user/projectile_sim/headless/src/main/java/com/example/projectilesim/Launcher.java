package com.example.projectilesim;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Entry point for the headless projectile simulation.
 *
 * <p>Bootstraps a {@link HeadlessApplication} (hosted on its own thread)
 * with a {@link SimulationListener} configured from the
 * {@code --scenario} and {@code --output} command line flags.  The launcher
 * parses the flags itself because the inner Gradle {@code application}
 * plugin's standard {@code --args} splitting doesn't quite cover the
 * verifier's invocation form.</p>
 *
 * <p>After the headless application signals completion
 * (via {@code Gdx.app.exit()}), this thread joins the application thread
 * so the JVM does not terminate mid-flush.</p>
 */
public final class Launcher {

    private Launcher() {
    }

    public static void main(String[] args) throws InterruptedException {
        ParsedArgs parsed = ParsedArgs.parse(args);

        HeadlessApplicationConfiguration cfg = new HeadlessApplicationConfiguration();
        // 0 = no cap, run as fast as the scheduler will let us: ideal for CI.
        cfg.updatesPerSecond = 0;

        SimulationListener listener =
            new SimulationListener(parsed.scenarioPath, parsed.outputPath);
        // Constructing HeadlessApplication starts its own non-daemon thread.
        @SuppressWarnings("unused")
        HeadlessApplication app = new HeadlessApplication(listener, cfg);

        // Block until the listener's dispose() has run and the writer has
        // been flushed.  HeadlessApplication runs on its own thread; once
        // it notices Gdx.app.exit() it will invoke dispose() on the
        // listener which counts down `disposedLatch`.
        listener.awaitDisposed();
    }

    /** Lightweight argv parser for {@code --scenario PATH --output PATH}. */
    static final class ParsedArgs {
        final String scenarioPath;
        final String outputPath;

        private ParsedArgs(String scenarioPath, String outputPath) {
            this.scenarioPath = scenarioPath;
            this.outputPath = outputPath;
        }

        static ParsedArgs parse(String[] argv) {
            String scenario = null;
            String output = null;
            for (int i = 0; i < argv.length; i++) {
                switch (argv[i]) {
                    case "--scenario":
                        if (++i >= argv.length) {
                            fail("--scenario requires a value");
                        }
                        scenario = argv[i];
                        break;
                    case "--output":
                        if (++i >= argv.length) {
                            fail("--output requires a value");
                        }
                        output = argv[i];
                        break;
                    default:
                        // Ignore unknown tokens.  Gradle / wrapper tooling
                        // sometimes injects things like "--console=plain".
                        break;
                }
            }
            if (scenario == null || scenario.isEmpty()) {
                fail("--scenario <path> is required");
            }
            if (output == null || output.isEmpty()) {
                fail("--output <path> is required");
            }
            return new ParsedArgs(scenario, output);
        }

        private static void fail(String msg) {
            System.err.println("Launcher: " + msg);
            System.exit(2);
        }
    }
}
