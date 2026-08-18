import { exec } from 'child_process';
import { db } from './db';

const lastExecuted = new Map<string, number>();
const currentlyExecuting = new Set<string>();

export function setTaskLastExecuted(id: string, time: number) {
  lastExecuted.set(id, time);
}

export function runTaskCommand(taskId: string, command: string): Promise<void> {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      const status = error ? 'FAILED' : 'SUCCESS';
      const timestamp = new Date().toISOString();
      try {
        db.prepare(`
          INSERT INTO execution_history (task_id, status, timestamp)
          VALUES (?, ?, ?)
        `).run(taskId, status, timestamp);
      } catch (err) {
        console.error(`Failed to log execution history for task ${taskId}:`, err);
      }
      resolve();
    });
  });
}

export function startBackgroundRunner() {
  if (typeof window !== 'undefined') {
    return;
  }
  // Prevent multiple runners in dev mode due to hot reloading
  if ((globalThis as any).__backgroundRunner__) {
    return;
  }

  const intervalId = setInterval(async () => {
    try {
      // Fetch active tasks
      const activeTasks = db.prepare("SELECT * FROM tasks WHERE status = 'ACTIVE'").all() as any[];
      const now = Date.now();

      for (const task of activeTasks) {
        if (currentlyExecuting.has(task.id)) {
          continue;
        }

        let lastTime = lastExecuted.get(task.id);

        if (lastTime === undefined) {
          // Check database for last execution
          const lastExecution = db.prepare(`
            SELECT timestamp FROM execution_history
            WHERE task_id = ?
            ORDER BY id DESC LIMIT 1
          `).get(task.id) as { timestamp: string } | undefined;

          if (lastExecution) {
            lastTime = new Date(lastExecution.timestamp).getTime();
            lastExecuted.set(task.id, lastTime);
          } else {
            // Never executed, execute immediately or set to 0
            lastTime = 0;
            lastExecuted.set(task.id, lastTime);
          }
        }

        if (now - lastTime >= task.interval_seconds * 1000) {
          currentlyExecuting.add(task.id);
          lastExecuted.set(task.id, now);

          runTaskCommand(task.id, task.command).finally(() => {
            currentlyExecuting.delete(task.id);
          });
        }
      }
    } catch (err) {
      console.error('Error in background runner loop:', err);
    }
  }, 1000);

  (globalThis as any).__backgroundRunner__ = intervalId;
  console.log('Background runner started.');
}
