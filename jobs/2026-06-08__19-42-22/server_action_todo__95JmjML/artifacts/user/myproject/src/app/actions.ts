"use server";

import { serverAction } from "rwsdk/worker";
import { env } from "cloudflare:workers";

export const addTodo = serverAction(async (formData: FormData) => {
  const title = formData.get("title");
  if (typeof title !== "string" || !title.trim()) return;

  const id = crypto.randomUUID();
  const todo = {
    id,
    title: title.trim(),
    done: false,
    createdAt: Date.now(),
  };

  await env.TODOS.put(`todo:${id}`, JSON.stringify(todo));
});

export const toggleTodo = serverAction(async (formData: FormData) => {
  const id = formData.get("id");
  const done = formData.get("done") === "on";
  if (typeof id !== "string") return;

  const data = await env.TODOS.get(`todo:${id}`);
  if (data) {
    const todo = JSON.parse(data);
    todo.done = done;
    await env.TODOS.put(`todo:${id}`, JSON.stringify(todo));
  }
});

export const deleteTodo = serverAction(async (formData: FormData) => {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  await env.TODOS.delete(`todo:${id}`);
});
