package com.example.astar;

import com.badlogic.gdx.utils.BinaryHeap;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;

public class Main {
    public static void main(String[] args) {
        System.out.println("BinaryHeap constructors:");
        for (Constructor<?> c : BinaryHeap.class.getDeclaredConstructors()) {
            System.out.println("  " + c.toString());
        }
        System.out.println("BinaryHeap fields:");
        for (Field f : BinaryHeap.class.getDeclaredFields()) {
            System.out.println("  " + f.toString());
        }
    }
}
