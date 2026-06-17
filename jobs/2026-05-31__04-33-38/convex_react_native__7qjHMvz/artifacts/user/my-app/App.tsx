import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, FlatList } from 'react-native';
import { ConvexProvider, ConvexReactClient, useQuery, useMutation } from "convex/react";
import { api } from "./convex/_generated/api";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL || "";
const runId = process.env.EXPO_PUBLIC_RUN_ID || "default";

const convex = new ConvexReactClient(convexUrl);

function TaskList() {
  const [text, setText] = useState("");
  const tasks = useQuery(api.tasks.getTasks, { runId }) || [];
  const addTask = useMutation(api.tasks.addTask);

  const handleAddTask = async () => {
    if (text.trim()) {
      await addTask({ text, runId });
      setText("");
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="New Task"
        testID="task-input"
      />
      <Pressable onPress={handleAddTask} testID="add-button" style={styles.button}>
        <Text style={styles.buttonText}>Add Task</Text>
      </Pressable>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.taskItem} testID="task-item">
            <Text>{item.text}</Text>
          </View>
        )}
      />
    </View>
  );
}

export default function App() {
  if (!convexUrl) {
    return (
      <View style={styles.container}>
        <Text>Error: EXPO_PUBLIC_CONVEX_URL is not set.</Text>
      </View>
    );
  }

  return (
    <ConvexProvider client={convex}>
      <TaskList />
    </ConvexProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  taskItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 10,
    alignItems: 'center',
    borderRadius: 5,
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
