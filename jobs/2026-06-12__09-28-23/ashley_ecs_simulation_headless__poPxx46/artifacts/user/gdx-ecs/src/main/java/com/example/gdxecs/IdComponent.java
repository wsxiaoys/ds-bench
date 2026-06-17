package com.example.gdxecs;

import com.badlogic.ashley.core.Component;

public final class IdComponent implements Component {
    public final String id;

    public IdComponent(String id) {
        this.id = id;
    }
}
