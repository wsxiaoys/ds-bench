package com.game.combodetector.headless;

import com.badlogic.gdx.Input.Keys;

public class KeyMapper {
    public static int getKeyCode(String keyName) {
        switch (keyName) {
            case "UP": return Keys.UP;
            case "DOWN": return Keys.DOWN;
            case "LEFT": return Keys.LEFT;
            case "RIGHT": return Keys.RIGHT;
            case "PUNCH": return Keys.X;
            case "KICK": return Keys.Z;
            case "PAUSE": return Keys.P;
            default: return -1;
        }
    }
}
