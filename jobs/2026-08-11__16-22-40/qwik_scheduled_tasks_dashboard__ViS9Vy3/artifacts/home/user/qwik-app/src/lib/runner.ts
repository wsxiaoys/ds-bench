import { exec } from 'node:child_process';
import db from './db';

// Keep track of currently executing task IDs to prevent concurrent runs of the same task
const currentlyExecuting = new Set<string>();

// Idempotent execution function
export function executeTask(taskId: string): Promise<void> {
  if (currentlyExecuting.has(taskId)) {
    // Already running, don't run concurrently
    return Promise.resolve();
  }

  // Query the task details
  const task = db.prepare('SELECT command FROM tasks WHERE id = ?').get(taskId) as { command: string } | undefined;
  if (!task) {
    return Promise.resolve();
  }

  currentlyExecuting.add(taskId);

  return new Promise<void>((resolve) => {
    exec(task.command, (error) => {
      const status = error ? 'FAILED' : 'SUCCESS';
      const timestamp = new Date().toISOString();

      try {
        const stmt = db.prepare(
          'INSERT INTO execution_history (task_id, status, timestamp) VALUES (?, ?, ?)'
        );
        stmt.run(taskId, status, timestamp);
      } catch (err) {
        console.error(`Failed to log execution history for task ${taskId}:`, err);
      } finally {
        currentlyExecuting.delete(taskId);
        resolve();
      }
    });
  });
}

export function startRunner() {
  // Use globalThis to ensure the runner only starts once, even with HMR
  const g = globalThis as any;
  if (g.__runner_started__) {
    return;
  }
  g.__runner_started__ = true;

  console.log('Background runner started.');

  // Poll the database every second
  setInterval(() => {
    try {
      // 1. Get all active tasks
      const activeTasks = db.prepare("SELECT * FROM tasks WHERE status = 'ACTIVE'").all() as any[];

      for (const task of activeTasks) {
        const { id, interval_seconds } = task;

        if (currentlyExecuting.has(id)) {
          continue;
        }

        // 2. Check the last execution timestamp for this task
        const lastExec = db.prepare(
          'SELECT timestamp FROM execution_history WHERE task_id = ? ORDER BY id DESC LIMIT 1'
        ).get(id) as { timestamp: string } | undefined;

        if (lastExec) {
          const lastExecTime = new Date(lastExec.timestamp).getTime();
          const elapsedSeconds = (Date.now() - lastExecTime) / 1000;

          if (elapsedSeconds >= interval_seconds) {
            // It's time to run!
            executeTask(id);
          }
        } else {
          // No execution history, run immediately
          executeTask(id);
        }
      }
    } catch (err) {
      console.error('Error in background runner polling loop:', err);
    }
  }, 1000);
}
