package projectile.sim;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

import java.lang.reflect.Field;

public final class Launcher {
    private Launcher() {
    }

    public static void main(String[] args) throws Exception {
        Arguments arguments = Arguments.parse(args);

        HeadlessApplicationConfiguration configuration = new HeadlessApplicationConfiguration();
        configuration.updatesPerSecond = 0;

        HeadlessApplication application = new HeadlessApplication(
                new ProjectileSimulation(arguments.scenarioPath, arguments.outputPath),
                configuration);
        joinHeadlessApplicationThread(application);
    }

    private static void joinHeadlessApplicationThread(HeadlessApplication application) throws Exception {
        Field field = HeadlessApplication.class.getDeclaredField("mainLoopThread");
        field.setAccessible(true);
        Thread thread = (Thread) field.get(application);
        thread.join();
    }

    private static final class Arguments {
        final String scenarioPath;
        final String outputPath;

        private Arguments(String scenarioPath, String outputPath) {
            this.scenarioPath = scenarioPath;
            this.outputPath = outputPath;
        }

        static Arguments parse(String[] args) {
            String scenarioPath = null;
            String outputPath = null;

            for (int i = 0; i < args.length; i++) {
                String arg = args[i];
                switch (arg) {
                    case "--scenario":
                        scenarioPath = requireValue(args, ++i, "--scenario");
                        break;
                    case "--output":
                        outputPath = requireValue(args, ++i, "--output");
                        break;
                    default:
                        throw new IllegalArgumentException("Unknown argument: " + arg);
                }
            }

            if (scenarioPath == null || outputPath == null) {
                throw new IllegalArgumentException("Usage: --scenario <scenario_path> --output <output_path>");
            }
            return new Arguments(scenarioPath, outputPath);
        }

        private static String requireValue(String[] args, int index, String flag) {
            if (index >= args.length) {
                throw new IllegalArgumentException("Missing value for " + flag);
            }
            return args[index];
        }
    }
}
