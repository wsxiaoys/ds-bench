package com.example.gdxstagesim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.MoveByAction;

public class Main {
    public static void main(String[] args) {
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;
        new HeadlessApplication(new ApplicationAdapter() {
            @Override
            public void create() {
                System.out.println("Testing MoveByAction...");
                Actor actor = new Actor();
                actor.setPosition(100, 100);

                MoveByAction action = new MoveByAction();
                action.setAmount(10, 20);
                action.setDuration(2.0f);
                actor.addAction(action);

                float dt = 1.5f;
                System.out.println("Initial position: " + actor.getX() + ", " + actor.getY());
                
                actor.act(dt);
                System.out.println("After act(1.5): " + actor.getX() + ", " + actor.getY());

                actor.act(dt);
                System.out.println("After act(1.5): " + actor.getX() + ", " + actor.getY());

                actor.act(dt);
                System.out.println("After act(1.5): " + actor.getX() + ", " + actor.getY());

                System.exit(0);
            }
        }, config);
    }
}
