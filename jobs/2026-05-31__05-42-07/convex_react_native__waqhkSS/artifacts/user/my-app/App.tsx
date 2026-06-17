import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, Button, FlatList } from 'react-native';
import { ConvexProvider, ConvexReactClient, useQuery, useMutation } from 'convex/react';
import { useState } from 'react';
import { api } from './convex/_generated/api';

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL || 'REDACTED';
const convex = new ConvexReactClient(convexUrl);

function TaskList() {
  const runId = process.env.EXPO_PUBLIC_RUN_ID || 'default-run-id';
  const tasks = useQuery(api.tasks.getTasks, { runId });
  const addTask = useMutation(api.tasks.addTask);
  const [text, setText] = useState('');

  const handleAddTask = async () => {
    if (text.trim()) {
      await addTask({ text, runId });
      setText('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tasks</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="New task"
          testID="task-input"
        />
        <Button title="Add" onPress={handleAddTask} testID="add-button" />
      </View>
      <FlatList
        data={tasks || []}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.taskItem}>
            <Text testID="task-item">{item.text}</Text>
          </View>
        )}
      />
    </View>
  );
}

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <View style={styles.appContainer}>
        <TaskList />
        <StatusBar style="auto" />
      </View>
    </ConvexProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 10,
    marginRight: 10,
    borderRadius: 4,
  },
  taskItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
});
