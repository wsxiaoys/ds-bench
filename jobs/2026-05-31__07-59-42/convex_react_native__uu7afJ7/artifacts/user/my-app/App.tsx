import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  FlatList,
} from "react-native";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "./convex/_generated/api";

const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL as string
);

function TaskList() {
  const runId = process.env.EXPO_PUBLIC_RUN_ID as string;
  const tasks = useQuery(api.tasks.getByRunId, { runId });
  const addTask = useMutation(api.tasks.add);
  const [newTaskText, setNewTaskText] = useState("");

  const handleAddTask = () => {
    if (newTaskText.trim() === "") return;
    addTask({ text: newTaskText.trim(), runId });
    setNewTaskText("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Task List</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newTaskText}
          onChangeText={setNewTaskText}
          placeholder="Add a new task..."
          testID="task-input"
        />
        <Pressable
          style={styles.button}
          onPress={handleAddTask}
          testID="add-button"
        >
          <Text style={styles.buttonText}>Add</Text>
        </Pressable>
      </View>
      {tasks === undefined ? (
        <Text>Loading tasks...</Text>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={styles.taskItem} testID="task-item">
              <Text style={styles.taskText}>{item.text}</Text>
            </View>
          )}
          style={styles.list}
        />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <TaskList />
    </ConvexProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: "row",
    marginBottom: 20,
    width: "90%",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginRight: 8,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  list: {
    width: "90%",
  },
  taskItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  taskText: {
    fontSize: 16,
  },
});