package com.mygdx.astar;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

public class Main extends ApplicationAdapter {
    private final String[] args;

    public Main(String[] args) {
        this.args = args;
    }

    @Override
    public void create() {
        try {
            System.out.println("Hello from libGDX Headless Application!");
            if (args.length > 0) {
                System.out.println("Arg 0: " + args[0]);
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            System.exit(0);
        }
    }

    public static void main(String[] args) {
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        new HeadlessApplication(new Main(args), config);
    }
}
