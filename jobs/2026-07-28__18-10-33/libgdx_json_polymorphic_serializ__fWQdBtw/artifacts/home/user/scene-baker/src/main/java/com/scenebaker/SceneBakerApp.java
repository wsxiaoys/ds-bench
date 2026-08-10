package com.scenebaker;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.utils.GdxRuntimeException;
import com.badlogic.gdx.utils.Json;
import com.badlogic.gdx.utils.JsonWriter;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;

/**
 * Headless application entry point: reads the scene JSON file named on the command
 * line, applies the canonicalization pipeline, and prints the single-line result.
 */
public class SceneBakerApp extends ApplicationAdapter {

    private final String[] args;

    public SceneBakerApp(String[] args) {
        this.args = args;
    }

    @Override
    public void create() {
        int exitCode = 0;
        try {
            if (args.length < 1) {
                System.err.println("Usage: scene-baker <scene.json>");
                exitCode = 2;
                return;
            }

            String content = new String(Files.readAllBytes(Paths.get(args[0])), StandardCharsets.UTF_8);

            Json json = new Json();
            json.setOutputType(JsonWriter.OutputType.minimal);
            json.setTypeName(null);

            NodeSerializer serializer = new NodeSerializer();
            json.setSerializer(Node.class, serializer);
            json.setSerializer(GroupNode.class, serializer);
            json.setSerializer(SpriteNode.class, serializer);
            json.setSerializer(LightNode.class, serializer);
            json.setSerializer(TriggerNode.class, serializer);

            Node root = json.fromJson(Node.class, content);
            if (!(root instanceof GroupNode)) {
                throw new GdxRuntimeException("Root node must be of type 'group'.");
            }
            GroupNode rootGroup = (GroupNode) root;
            // The root is always enabled, regardless of what the input JSON says.
            rootGroup.enabled = true;

            ScenePipeline.prune(rootGroup);
            ScenePipeline.assignIds(rootGroup);
            ScenePipeline.computeTransforms(rootGroup, 1f, 0f, 0f);

            String out = json.toJson(rootGroup, Node.class);
            System.out.println(out);
        } catch (Exception ex) {
            System.err.println("Error: " + ex.getMessage());
            exitCode = 1;
        } finally {
            System.out.flush();
            Gdx.app.exit();
            if (exitCode != 0) {
                System.exit(exitCode);
            }
        }
    }
}
