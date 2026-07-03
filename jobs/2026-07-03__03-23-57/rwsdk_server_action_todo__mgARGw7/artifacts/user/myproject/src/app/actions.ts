"use server";

import { serverAction } from "rwsdk/worker";
import { env } from "cloudflare:workers";

export const addTodo = serverAction(async (formData: FormData) => {
  const title = formData.get("title")?.toString().trim();
  if (!title) return;
  const id = crypto.randomUUID();
  const todo = {
    id,
    title,
    done: false,
    createdAt: Date.now(),
  };
  await env.TODOS.put(`todo:${id}`, JSON.stringify(todo));
});

export const toggleTodo = serverAction(async (formData: FormData) => {
  const id = formData.get("id")?.toString();
  if (!id) return;
  const val = await env.TODOS.get(`todo:${id}`);
  if (!val) return;
  const todo = JSON.parse(val);
  const done = formData.has("done");
  todo.done = done;
  await env.TODOS.put(`todo:${id}`, JSON.stringify(todo));
});

export const deleteTodo = serverAction(async (formData: FormData) => {
  const id = formData.get("id")?.toString();
  if (!id) return;
  await env.TODOS.delete(`todo:${id}`);
});
