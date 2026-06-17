import { createServerFn } from '@tanstack/react-start';
import db from './db';

export const getCount = createServerFn({ method: 'GET' }).handler(async () => {
  const row = db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number };
  return { count: row.count };
});

export const incrementCount = createServerFn({ method: 'POST' }).handler(async () => {
  db.prepare('UPDATE counter SET count = count + 1 WHERE id = 1').run();
  const row = db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number };
  return { count: row.count };
});
