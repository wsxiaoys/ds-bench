"use server";

import { serverAction } from "rwsdk/worker";
import { env } from "cloudflare:workers";

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
}

export const addTodo = serverAction(async (formData: FormData) => {
  const title = formData.get("title") as string;
  if (!title || !title.trim()) return;

  const id = crypto.randomUUID();
  const todo: Todo = {
    id,
    title: title.trim(),
    done: false,
    createdAt: Date.now(),
  };

  await env.TODOS.put(`todo:${id}`, JSON.stringify(todo));
});

export const toggleTodo = serverAction(async (formData: FormData) => {
  const id = formData.get("id") as string;
  if (!id) return;

  const value = await env.TODOS.get(`todo:${id}`);
  if (!value) return;

  const todo: Todo = JSON.parse(value);
  todo.done = !todo.done;

  await env.TODOS.put(`todo:${id}`, JSON.stringify(todo));
});

export const deleteTodo = serverAction(async (formData: FormData) => {
  const id = formData.get("id") as string;
  if (!id) return;

  await env.TODOS.delete(`todo:${id}`);
});