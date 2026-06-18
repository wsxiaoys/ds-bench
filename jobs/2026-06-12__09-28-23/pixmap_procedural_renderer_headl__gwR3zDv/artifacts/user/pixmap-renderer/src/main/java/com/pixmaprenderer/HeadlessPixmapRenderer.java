package com.pixmaprenderer;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.PixmapIO;
import com.badlogic.gdx.utils.GdxRuntimeException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;

public class HeadlessPixmapRenderer extends ApplicationAdapter {

    private final String inputContent;
    private final String outputPath;
    private int pixmapWidth;
    private int pixmapHeight;
    private int commandCount;

    public HeadlessPixmapRenderer(String inputContent, String outputPath) {
        this.inputContent = inputContent;
        this.outputPath = outputPath;
        this.commandCount = 0;
    }

    @Override
    public void create() {
        try {
            Pixmap pixmap = processScript(inputContent);
            writePng(pixmap, outputPath);
            pixmap.dispose();
            System.out.println("RENDER_OK width=" + pixmapWidth + " height=" + pixmapHeight + " commands=" + commandCount);
        } catch (Exception e) {
            System.err.println("ERROR: " + e.getMessage());
            e.printStackTrace(System.err);
        } finally {
            Gdx.app.exit();
        }
    }

    private Pixmap processScript(String script) throws IOException {
        BufferedReader reader = new BufferedReader(new StringReader(script));
        String line;
        Pixmap pixmap = null;

        while ((line = reader.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }

            String[] tokens = line.split("\\s+");
            String cmd = tokens[0].toUpperCase();

            switch (cmd) {
                case "SIZE":
                    if (pixmap != null) {
                        throw new GdxRuntimeException("SIZE must be the first command");
                    }
                    pixmapWidth = Integer.parseInt(tokens[1]);
                    pixmapHeight = Integer.parseInt(tokens[2]);
                    pixmap = new Pixmap(pixmapWidth, pixmapHeight, Pixmap.Format.RGBA8888);
                    break;

                case "FILL":
                    ensurePixmap(pixmap);
                    float fr = Integer.parseInt(tokens[1]) / 255f;
                    float fg = Integer.parseInt(tokens[2]) / 255f;
                    float fb = Integer.parseInt(tokens[3]) / 255f;
                    float fa = Integer.parseInt(tokens[4]) / 255f;
                    pixmap.setColor(fr, fg, fb, fa);
                    pixmap.fill();
                    commandCount++;
                    break;

                case "RECT":
                    ensurePixmap(pixmap);
                    int rx = Integer.parseInt(tokens[1]);
                    int ry = Integer.parseInt(tokens[2]);
                    int rw = Integer.parseInt(tokens[3]);
                    int rh = Integer.parseInt(tokens[4]);
                    float rr = Integer.parseInt(tokens[5]) / 255f;
                    float rg = Integer.parseInt(tokens[6]) / 255f;
                    float rb = Integer.parseInt(tokens[7]) / 255f;
                    float ra = Integer.parseInt(tokens[8]) / 255f;
                    pixmap.setColor(rr, rg, rb, ra);
                    pixmap.fillRectangle(rx, ry, rw, rh);
                    commandCount++;
                    break;

                case "LINE":
                    ensurePixmap(pixmap);
                    int x1 = Integer.parseInt(tokens[1]);
                    int y1 = Integer.parseInt(tokens[2]);
                    int x2 = Integer.parseInt(tokens[3]);
                    int y2 = Integer.parseInt(tokens[4]);
                    float lr = Integer.parseInt(tokens[5]) / 255f;
                    float lg = Integer.parseInt(tokens[6]) / 255f;
                    float lb = Integer.parseInt(tokens[7]) / 255f;
                    float la = Integer.parseInt(tokens[8]) / 255f;
                    pixmap.setColor(lr, lg, lb, la);
                    pixmap.drawLine(x1, y1, x2, y2);
                    commandCount++;
                    break;

                case "CIRCLE":
                    ensurePixmap(pixmap);
                    int cx = Integer.parseInt(tokens[1]);
                    int cy = Integer.parseInt(tokens[2]);
                    int radius = Integer.parseInt(tokens[3]);
                    float cr = Integer.parseInt(tokens[4]) / 255f;
                    float cg = Integer.parseInt(tokens[5]) / 255f;
                    float cb = Integer.parseInt(tokens[6]) / 255f;
                    float ca = Integer.parseInt(tokens[7]) / 255f;
                    pixmap.setColor(cr, cg, cb, ca);
                    pixmap.fillCircle(cx, cy, radius);
                    commandCount++;
                    break;

                case "PIXEL":
                    ensurePixmap(pixmap);
                    int px = Integer.parseInt(tokens[1]);
                    int py = Integer.parseInt(tokens[2]);
                    float pr = Integer.parseInt(tokens[3]) / 255f;
                    float pg = Integer.parseInt(tokens[4]) / 255f;
                    float pb = Integer.parseInt(tokens[5]) / 255f;
                    float pa = Integer.parseInt(tokens[6]) / 255f;
                    pixmap.setColor(pr, pg, pb, pa);
                    pixmap.drawPixel(px, py);
                    commandCount++;
                    break;

                default:
                    throw new GdxRuntimeException("Unknown command: " + cmd);
            }
        }

        if (pixmap == null) {
            throw new GdxRuntimeException("No SIZE command found in script");
        }

        return pixmap;
    }

    private void ensurePixmap(Pixmap pixmap) {
        if (pixmap == null) {
            throw new GdxRuntimeException("SIZE must be specified before any drawing commands");
        }
    }

    private void writePng(Pixmap pixmap, String outputPath) {
        FileHandle handle = Gdx.files.absolute(outputPath);
        PixmapIO.writePNG(handle, pixmap);
    }
}
