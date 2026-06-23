package pixmap.renderer;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

public class PixmapRendererLauncher {
    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: java -jar pixmap-renderer.jar <input_file> <output_png>");
            System.exit(1);
        }

        String inputFilePath = args[0];
        String outputFilePath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        
        PixmapRendererApp app = new PixmapRendererApp(inputFilePath, outputFilePath);
        HeadlessApplication headlessApp = new HeadlessApplication(app, config);

        // Find and join the HeadlessApplication thread
        Thread headlessThread = null;
        for (int i = 0; i < 100; i++) {
            for (Thread t : Thread.getAllStackTraces().keySet()) {
                if ("HeadlessApplication".equals(t.getName())) {
                    headlessThread = t;
                    break;
                }
            }
            if (headlessThread != null) {
                break;
            }
            try {
                Thread.sleep(10);
            } catch (InterruptedException e) {
                break;
            }
        }

        if (headlessThread != null) {
            try {
                headlessThread.join();
            } catch (InterruptedException e) {
                System.err.println("Headless application thread was interrupted.");
                Thread.currentThread().interrupt();
                System.exit(1);
            }
        } else {
            System.err.println("Warning: HeadlessApplication thread not found.");
        }

        if (app.isSuccess()) {
            System.out.println("RENDER_OK width=" + app.getWidth() + " height=" + app.getHeight() + " commands=" + app.getCommandCount());
            System.exit(0);
        } else {
            System.err.println("Error rendering pixmap: " + app.getErrorMessage());
            System.exit(1);
        }
    }
}
