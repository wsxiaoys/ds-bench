package com.game.headless;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import java.lang.reflect.Method;
public class CheckThread {
    public static void main(String[] args) {
        for (Method m : HeadlessApplication.class.getMethods()) {
            System.out.println(m.getName());
        }
    }
}
