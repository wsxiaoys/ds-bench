import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ConvexProvider, ConvexReactClient, useQuery, useMutation } from "convex/react";
import { api } from "./convex/_generated/api";

// Initialize Convex client
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL || "REDACTED";
const convex = new ConvexReactClient(convexUrl);

const runId = process.env.EXPO_PUBLIC_RUN_ID || "zrq2zk0i4g";

function TaskApp() {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch tasks filtered by runId
  const tasks = useQuery(api.tasks.get, { runId });
  
  // Mutation to add new task
  const addTask = useMutation(api.tasks.add);

  const handleAddTask = async () => {
    if (!text.trim()) return;
    setIsSubmitting(true);
    try {
      await addTask({ text: text.trim(), runId });
      setText("");
    } catch (error) {
      console.error("Failed to add task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reactive Task List</Text>
          <Text style={styles.runIdText}>Run ID: {runId}</Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add a new task..."
            placeholderTextColor="#888"
            value={text}
            onChangeText={setText}
            testID="task-input"
            editable={!isSubmitting}
          />
          <TouchableOpacity
            style={[styles.button, !text.trim() && styles.buttonDisabled]}
            onPress={handleAddTask}
            disabled={isSubmitting || !text.trim()}
            testID="add-button"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Add</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {tasks === undefined ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text style={styles.loadingText}>Loading tasks...</Text>
            </View>
          ) : tasks.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No tasks yet. Add one above!</Text>
            </View>
          ) : (
            <FlatList
              data={tasks}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <View testID="task-item" style={styles.taskItem}>
                  <View style={styles.taskDot} />
                  <Text style={styles.taskText}>{item.text}</Text>
                </View>
              )}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <TaskApp />
      <StatusBar style="REDACTED" />
    </ConvexProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 10,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  runIdText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    marginRight: 10,
  },
  button: {
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 20,
    minWidth: 80,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  taskItem: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 12,
  },
  taskText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 16,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
  },
});
