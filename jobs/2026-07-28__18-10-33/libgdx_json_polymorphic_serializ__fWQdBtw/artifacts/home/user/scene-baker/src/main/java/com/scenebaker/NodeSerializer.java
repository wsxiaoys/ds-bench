package com.scenebaker;

import com.badlogic.gdx.utils.Array;
import com.badlogic.gdx.utils.Json;
import com.badlogic.gdx.utils.JsonValue;
import com.badlogic.gdx.utils.SerializationException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;

/**
 * Custom libGDX {@link com.badlogic.gdx.utils.Json.Serializer} for the polymorphic
 * {@link Node} hierarchy. Drives both reading (JsonValue -&gt; Node graph) and writing
 * (Node graph -&gt; canonical minimal JSON) using a {@code type} discriminator field.
 *
 * <p>The recursion for nested nodes (group children) is performed directly by this
 * class (rather than through Json's generic type-dispatch machinery) so that the exact
 * field order required by the canonical output format is fully under our control.
 */
public class NodeSerializer implements Json.Serializer<Node> {

    static final String TYPE_GROUP = "group";
    static final String TYPE_SPRITE = "sprite";
    static final String TYPE_LIGHT = "light";
    static final String TYPE_TRIGGER = "trigger";

    @Override
    public void write(Json json, Node node, Class knownType) {
        json.writeObjectStart();

        json.writeValue("type", node.kindTag());
        json.writeValue("id", node.id);
        json.writeValue("name", node.name);
        json.writeValue("lx", fmt(node.lx));
        json.writeValue("ly", fmt(node.ly));
        json.writeValue("ls", fmt(node.ls));
        json.writeValue("absX", fmt(node.absX));
        json.writeValue("absY", fmt(node.absY));
        json.writeValue("absScale", fmt(node.absScale));

        if (node instanceof GroupNode) {
            GroupNode group = (GroupNode) node;
            json.writeArrayStart("children");
            for (Node child : group.children) {
                write(json, child, Node.class);
            }
            json.writeArrayEnd();
        } else if (node instanceof SpriteNode) {
            SpriteNode sprite = (SpriteNode) node;
            json.writeValue("region", sprite.region);
            json.writeValue("z", sprite.z);
            json.writeArrayStart("frames");
            for (int i = 0; i < sprite.frames.size; i++) {
                json.writeValue(sprite.frames.get(i));
            }
            json.writeArrayEnd();
        } else if (node instanceof LightNode) {
            LightNode light = (LightNode) node;
            json.writeValue("color", light.color);
            json.writeValue("intensity", fmt(light.intensity));
        } else if (node instanceof TriggerNode) {
            TriggerNode trigger = (TriggerNode) node;
            json.writeValue("event", trigger.event);

            json.writeObjectStart("params");
            Array<String> keys = new Array<>();
            for (String key : trigger.params.keys()) {
                keys.add(key);
            }
            keys.sort(CODE_POINT_ORDER);
            for (String key : keys) {
                json.writeValue(key, trigger.params.get(key));
            }
            json.writeObjectEnd();

            json.writeArrayStart("targets");
            for (int i = 0; i < trigger.targets.size; i++) {
                json.writeValue(trigger.targets.get(i));
            }
            json.writeArrayEnd();
        }

        json.writeObjectEnd();
    }

    @Override
    public Node read(Json json, JsonValue jsonData, Class type) {
        String tag = jsonData.getString("type", null);
        if (tag == null) {
            throw new SerializationException("Node is missing required 'type' field: " + jsonData.trace());
        }

        Node node;
        switch (tag) {
            case TYPE_GROUP:
                node = new GroupNode();
                break;
            case TYPE_SPRITE:
                node = new SpriteNode();
                break;
            case TYPE_LIGHT:
                node = new LightNode();
                break;
            case TYPE_TRIGGER:
                node = new TriggerNode();
                break;
            default:
                throw new SerializationException("Unknown node type '" + tag + "': " + jsonData.trace());
        }

        node.type = tag;
        node.name = jsonData.getString("name", "");
        node.enabled = jsonData.getBoolean("enabled", true);
        node.lx = jsonData.getFloat("lx", 0f);
        node.ly = jsonData.getFloat("ly", 0f);
        node.ls = jsonData.getFloat("ls", 1f);

        switch (tag) {
            case TYPE_GROUP: {
                GroupNode group = (GroupNode) node;
                JsonValue childrenValue = jsonData.get("children");
                if (childrenValue != null) {
                    for (JsonValue child = childrenValue.child; child != null; child = child.next) {
                        group.children.add(read(json, child, Node.class));
                    }
                }
                break;
            }
            case TYPE_SPRITE: {
                SpriteNode sprite = (SpriteNode) node;
                sprite.region = jsonData.getString("region", null);
                sprite.z = jsonData.getInt("z", 0);
                JsonValue framesValue = jsonData.get("frames");
                if (framesValue != null) {
                    for (JsonValue f = framesValue.child; f != null; f = f.next) {
                        sprite.frames.add(f.asInt());
                    }
                }
                break;
            }
            case TYPE_LIGHT: {
                LightNode light = (LightNode) node;
                light.color = jsonData.getString("color", null);
                light.intensity = jsonData.getFloat("intensity", 0f);
                break;
            }
            case TYPE_TRIGGER: {
                TriggerNode trigger = (TriggerNode) node;
                trigger.event = jsonData.getString("event", null);
                JsonValue paramsValue = jsonData.get("params");
                if (paramsValue != null) {
                    for (JsonValue p = paramsValue.child; p != null; p = p.next) {
                        trigger.params.put(p.name, p.asString());
                    }
                }
                JsonValue targetsValue = jsonData.get("targets");
                if (targetsValue != null) {
                    for (JsonValue t = targetsValue.child; t != null; t = t.next) {
                        trigger.targets.add(t.asInt());
                    }
                }
                break;
            }
            default:
                break;
        }

        return node;
    }

    /** Formats a float as a decimal string with exactly three digits after the decimal
     * point, rounded half-up, without exponent notation and without a spurious "-0.000". */
    static String fmt(float value) {
        BigDecimal bd = new BigDecimal(Float.toString(value)).setScale(3, RoundingMode.HALF_UP);
        if (bd.compareTo(BigDecimal.ZERO) == 0) {
            bd = BigDecimal.ZERO.setScale(3);
        }
        return bd.toPlainString();
    }

    /** Orders strings by ascending Unicode code point (not UTF-16 code unit). */
    static final Comparator<String> CODE_POINT_ORDER = (a, b) -> {
        int i = 0, j = 0;
        int la = a.length(), lb = b.length();
        while (i < la && j < lb) {
            int cpA = a.codePointAt(i);
            int cpB = b.codePointAt(j);
            if (cpA != cpB) return Integer.compare(cpA, cpB);
            i += Character.charCount(cpA);
            j += Character.charCount(cpB);
        }
        return Integer.compare(la - i, lb - j);
    };
}
