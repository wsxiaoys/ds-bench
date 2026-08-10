package com.scenebaker;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * Launches the headless libGDX application. No OpenGL/graphics are used; the
 * headless backend is used purely to host the {@link SceneBakerApp} lifecycle.
 */
public class SceneBakerLauncher {
    public static void main(String[] args) {
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // Negative target render interval means render() is never invoked; all work
        // happens once in create(), after which the application disposes and exits.
        config.updatesPerSecond = -1;
        new HeadlessApplication(new SceneBakerApp(args), config);
    }
}
