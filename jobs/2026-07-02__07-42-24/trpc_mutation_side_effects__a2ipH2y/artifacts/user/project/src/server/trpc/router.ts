import { router, publicProcedure } from './trpc';
import { z } from 'zod';

const todos = [{ id: 1, text: 'Initial Todo' }];

export const appRouter = router({
  getTodos: publicProcedure.query(() => {
    return todos;
  }),
  addTodo: publicProcedure.input(z.object({ text: z.string() })).mutation(({ input }) => {
    const newTodo = { id: Date.now(), text: input.text };
    todos.push(newTodo);
    return newTodo;
  }),
});

export type AppRouter = typeof appRouter;
