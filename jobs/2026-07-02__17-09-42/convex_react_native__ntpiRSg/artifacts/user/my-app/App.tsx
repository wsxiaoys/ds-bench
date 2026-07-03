import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  FlatList,
  SafeAreaView,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { ConvexProvider, ConvexReactClient, useQuery, useMutation } from "convex/react";
import { api } from "./convex/_generated/api";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL as string;
const runId = process.env.EXPO_PUBLIC_RUN_ID as string;

const convex = new ConvexReactClient(convexUrl, { unsavedChangesWarning: false });

function TaskList() {
  const tasks = useQuery(api.tasks.list, { runId }) ?? [];
  const addTask = useMutation(api.tasks.add);
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
      <Text style={styles.title}>Reactive Tasks</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Enter a task"
          placeholderTextColor="#888"
          value={text}
          onChangeText={setText}
          testID="task-input"
          onSubmitEditing={handleAdd}
        />
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleAdd}
          testID="add-button"
        >
          <Text style={styles.buttonText}>Add</Text>
        </Pressable>
      </View>
      <FlatList
        style={styles.list}
        data={tasks}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.taskItem} testID="task-item">
            <Text style={styles.taskText}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No tasks yet. Add one above!</Text>
        }
      />
    </View>
  );
}

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="REDACTED" />
        <TaskList />
      </SafeAreaView>
    </ConvexProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "web" ? 20 : 0,
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#111",
    textAlign: "center",
  },
  inputRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  input: {
    flex: 1,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111",
    backgroundColor: "#fafafa",
    marginRight: 10,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  taskItem: {
    backgroundColor: "#f1f3f5",
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  taskText: {
    fontSize: 16,
    color: "#111",
  },
  emptyText: {
    textAlign: "center",
    color: "#888",
    marginTop: 20,
  },
});