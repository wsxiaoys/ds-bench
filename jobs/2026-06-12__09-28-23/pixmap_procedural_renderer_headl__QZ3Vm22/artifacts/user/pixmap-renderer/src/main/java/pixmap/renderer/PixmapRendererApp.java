package pixmap.renderer;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.PixmapIO;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;

public class PixmapRendererApp implements ApplicationListener {
    private final String inputFilePath;
    private final String outputFilePath;
    
    private int width = 0;
    private int height = 0;
    private int commandCount = 0;
    private boolean success = false;
    private String errorMessage = null;

    public PixmapRendererApp(String inputFilePath, String outputFilePath) {
        this.inputFilePath = inputFilePath;
        this.outputFilePath = outputFilePath;
    }

    @Override
    public void create() {
        Pixmap pixmap = null;
        try {
            File inputFile = new File(inputFilePath);
            if (!inputFile.exists()) {
                throw new IllegalArgumentException("Input file does not exist: " + inputFilePath);
            }

            try (BufferedReader reader = new BufferedReader(new FileReader(inputFile))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty() || line.startsWith("#")) {
                        continue;
                    }

                    String[] tokens = line.split("\\s+");
                    if (tokens.length == 0) {
                        continue;
                    }

                    String cmd = tokens[0].toUpperCase();
                    if (pixmap == null) {
                        if (!"SIZE".equals(cmd)) {
                            throw new IllegalStateException("First drawing command must be SIZE");
                        }
                        if (tokens.length < 3) {
                            throw new IllegalArgumentException("SIZE command requires width and height");
                        }
                        width = Integer.parseInt(tokens[1]);
                        height = Integer.parseInt(tokens[2]);
                        if (width <= 0 || height <= 0) {
                            throw new IllegalArgumentException("Width and height must be positive integers");
                        }
                        pixmap = new Pixmap(width, height, Pixmap.Format.RGBA8888);
                        continue;
                    }

                    if ("SIZE".equals(cmd)) {
                        throw new IllegalStateException("SIZE command can only be specified once as the first command");
                    }

                    commandCount++;
                    switch (cmd) {
                        case "FILL": {
                            if (tokens.length < 5) {
                                throw new IllegalArgumentException("FILL command requires r, g, b, a");
                            }
                            float r = Integer.parseInt(tokens[1]) / 255.0f;
                            float g = Integer.parseInt(tokens[2]) / 255.0f;
                            float b = Integer.parseInt(tokens[3]) / 255.0f;
                            float a = Integer.parseInt(tokens[4]) / 255.0f;
                            pixmap.setColor(r, g, b, a);
                            pixmap.fill();
                            break;
                        }
                        case "RECT": {
                            if (tokens.length < 9) {
                                throw new IllegalArgumentException("RECT command requires x, y, w, h, r, g, b, a");
                            }
                            int x = Integer.parseInt(tokens[1]);
                            int y = Integer.parseInt(tokens[2]);
                            int w = Integer.parseInt(tokens[3]);
                            int h = Integer.parseInt(tokens[4]);
                            float r = Integer.parseInt(tokens[5]) / 255.0f;
                            float g = Integer.parseInt(tokens[6]) / 255.0f;
                            float b = Integer.parseInt(tokens[7]) / 255.0f;
                            float a = Integer.parseInt(tokens[8]) / 255.0f;
                            pixmap.setColor(r, g, b, a);
                            pixmap.fillRectangle(x, y, w, h);
                            break;
                        }
                        case "LINE": {
                            if (tokens.length < 9) {
                                throw new IllegalArgumentException("LINE command requires x1, y1, x2, y2, r, g, b, a");
                            }
                            int x1 = Integer.parseInt(tokens[1]);
                            int y1 = Integer.parseInt(tokens[2]);
                            int x2 = Integer.parseInt(tokens[3]);
                            int y2 = Integer.parseInt(tokens[4]);
                            float r = Integer.parseInt(tokens[5]) / 255.0f;
                            float g = Integer.parseInt(tokens[6]) / 255.0f;
                            float b = Integer.parseInt(tokens[7]) / 255.0f;
                            float a = Integer.parseInt(tokens[8]) / 255.0f;
                            pixmap.setColor(r, g, b, a);
                            pixmap.drawLine(x1, y1, x2, y2);
                            break;
                        }
                        case "CIRCLE": {
                            if (tokens.length < 8) {
                                throw new IllegalArgumentException("CIRCLE command requires cx, cy, radius, r, g, b, a");
                            }
                            int cx = Integer.parseInt(tokens[1]);
                            int cy = Integer.parseInt(tokens[2]);
                            int radius = Integer.parseInt(tokens[3]);
                            float r = Integer.parseInt(tokens[4]) / 255.0f;
                            float g = Integer.parseInt(tokens[5]) / 255.0f;
                            float b = Integer.parseInt(tokens[6]) / 255.0f;
                            float a = Integer.parseInt(tokens[7]) / 255.0f;
                            pixmap.setColor(r, g, b, a);
                            pixmap.fillCircle(cx, cy, radius);
                            break;
                        }
                        case "PIXEL": {
                            if (tokens.length < 7) {
                                throw new IllegalArgumentException("PIXEL command requires x, y, r, g, b, a");
                            }
                            int x = Integer.parseInt(tokens[1]);
                            int y = Integer.parseInt(tokens[2]);
                            float r = Integer.parseInt(tokens[3]) / 255.0f;
                            float g = Integer.parseInt(tokens[4]) / 255.0f;
                            float b = Integer.parseInt(tokens[5]) / 255.0f;
                            float a = Integer.parseInt(tokens[6]) / 255.0f;
                            pixmap.setColor(r, g, b, a);
                            pixmap.drawPixel(x, y);
                            break;
                        }
                        default:
                            throw new IllegalArgumentException("Unknown command: " + cmd);
                    }
                }
            }

            if (pixmap == null) {
                throw new IllegalStateException("No SIZE command found in input file");
            }

            // Write output PNG
            File outputFile = new File(outputFilePath);
            File parentDir = outputFile.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }
            FileHandle fileHandle = Gdx.files.absolute(outputFile.getAbsolutePath());
            PixmapIO.writePNG(fileHandle, pixmap);
            success = true;
        } catch (Exception e) {
            errorMessage = e.getMessage();
            e.printStackTrace();
        } finally {
            if (pixmap != null) {
                pixmap.dispose();
            }
            Gdx.app.exit();
        }
    }

    @Override
    public void resize(int width, int height) {}

    @Override
    public void render() {}

    @Override
    public void pause() {}

    @Override
    public void resume() {}

    @Override
    public void dispose() {}

    public boolean isSuccess() {
        return success;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public int getWidth() {
        return width;
    }

    public int getHeight() {
        return height;
    }

    public int getCommandCount() {
        return commandCount;
    }
}
