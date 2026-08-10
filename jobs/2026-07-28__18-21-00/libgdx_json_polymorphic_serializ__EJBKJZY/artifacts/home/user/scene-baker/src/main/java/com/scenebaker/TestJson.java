package com.scenebaker;

import com.badlogic.gdx.utils.Json;
import com.badlogic.gdx.utils.JsonValue;
import com.badlogic.gdx.utils.JsonWriter;

import java.io.StringWriter;

public class TestJson {
    public static class Dummy {
        public String name;
        public int value;
    }

    public static void main(String[] args) {
        Json json = new Json();
        json.setOutputType(JsonWriter.OutputType.minimal);
        json.setSerializer(Dummy.class, new Json.Serializer<Dummy>() {
            @Override
            public void write(Json json, Dummy object, Class knownType) {
                json.writeObjectStart();
                json.writeValue("name", object.name);
                json.writeValue("value", object.value);
                json.writeObjectEnd();
            }

            @Override
            public Dummy read(Json json, JsonValue jsonData, Class type) {
                Dummy d = new Dummy();
                d.name = jsonData.getString("name");
                d.value = jsonData.getInt("value");
                return d;
            }
        });

        Dummy d = new Dummy();
        d.name = "hello";
        d.value = 42;

        String result = json.toJson(d);
        System.out.println("Result: " + result);

        Dummy decoded = json.fromJson(Dummy.class, result);
        System.out.println("Decoded: " + decoded.name + ", " + decoded.value);
    }
}
