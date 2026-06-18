import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View, FlatList, Pressable } from "react-native";
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from "convex/react";
import { api } from "./convex/_generated/api";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const runId = process.env.EXPO_PUBLIC_RUN_ID ?? "default";

function TaskList() {
  const tasks = useQuery(api.tasks.listByRunId, { runId });
  const addTask = useMutation(api.tasks.addTask);
  const [text, setText] = useState("");

  const handleAdd = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    await addTask({ text: trimmed, runId });
    setText("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tasks</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Add a task"
          testID="task-input"
        />
        <Pressable style={styles.button} onPress={handleAdd} testID="add-button">
          <Text style={styles.buttonText}>Add</Text>
        </Pressable>
      </View>
      <FlatList
        data={tasks ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.taskItem} testID="task-item">
            <Text style={styles.taskText}>{item.text}</Text>
          </View>
        )}
      />
    </View>
  );
}

export default function App() {
  const client = useMemo(() => {
    if (!convexUrl) {
      throw new Error("EXPO_PUBLIC_CONVEX_URL is not set");
    }
    return new ConvexReactClient(convexUrl);
  }, []);

  return (
    <ConvexProvider client={client}>
      <TaskList />
    </ConvexProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  list: {
    paddingBottom: 24,
  },
  taskItem: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  taskText: {
    fontSize: 16,
  },
});
