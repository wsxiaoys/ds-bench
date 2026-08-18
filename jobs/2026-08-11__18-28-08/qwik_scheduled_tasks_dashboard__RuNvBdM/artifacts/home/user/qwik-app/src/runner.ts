import db from './db';
import { exec } from 'child_process';

const currentlyRunning = new Set<string>();
const lastExecuted = new Map<string, number>();

export function startRunner() {
  console.log('Starting background tasks runner...');
  
  setInterval(() => {
    try {
      // Get all active tasks
      const activeTasks = db.prepare("SELECT * FROM tasks WHERE status = 'ACTIVE'").all() as any[];
      const now = Date.now();
      
      for (const task of activeTasks) {
        if (currentlyRunning.has(task.id)) {
          continue;
        }
        
        let lastRun = lastExecuted.get(task.id);
        if (lastRun === undefined) {
          // Initialize from history if available
          const latestHistory = db.prepare(
            "SELECT timestamp FROM execution_history WHERE task_id = ? ORDER BY timestamp DESC LIMIT 1"
          ).get(task.id) as { timestamp: string } | undefined;
          
          if (latestHistory) {
            lastRun = new Date(latestHistory.timestamp).getTime();
          } else {
            // Run immediately
            lastRun = 0;
          }
          lastExecuted.set(task.id, lastRun);
        }
        
        if (now - lastRun >= task.interval_seconds * 1000) {
          // Execute task
          lastExecuted.set(task.id, now);
          currentlyRunning.add(task.id);
          
          console.log(`[Runner] Executing task "${task.name}" (${task.id}): ${task.command}`);
          
          exec(task.command, (error) => {
            currentlyRunning.delete(task.id);
            const status = error === null ? 'SUCCESS' : 'FAILED';
            const timestamp = new Date().toISOString();
            
            try {
              db.prepare(
                "INSERT INTO execution_history (task_id, status, timestamp) VALUES (?, ?, ?)"
              ).run(task.id, status, timestamp);
              console.log(`[Runner] Task "${task.name}" (${task.id}) finished with status: ${status}`);
            } catch (err) {
              console.error(`[Runner] Failed to insert execution history for task ${task.id}:`, err);
            }
          });
        }
      }
      
      // Clean up lastExecuted for tasks that are no longer active or deleted
      const activeIds = new Set(activeTasks.map(t => t.id));
      for (const id of lastExecuted.keys()) {
        if (!activeIds.has(id)) {
          lastExecuted.delete(id);
        }
      }
      
    } catch (err) {
      console.error('[Runner] Error in background runner loop:', err);
    }
  }, 1000);
}
