package com.simulator;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.utils.BinaryHeap;

public class HeadlessLauncher implements ApplicationListener {
    public static void main(String[] args) {
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        new HeadlessApplication(new HeadlessLauncher(), config);
    }

    @Override
    public void create() {
        System.out.println("Hello from libGDX Headless!");
        
        // Let's print BinaryHeap methods and fields using reflection
        for (java.lang.reflect.Field field : BinaryHeap.class.getFields()) {
            System.out.println("Field: " + field.getType().getName() + " " + field.getName());
        }
        for (java.lang.reflect.Method method : BinaryHeap.class.getMethods()) {
            System.out.println("Method: " + method.toString());
        }
        
        System.exit(0);
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
}
