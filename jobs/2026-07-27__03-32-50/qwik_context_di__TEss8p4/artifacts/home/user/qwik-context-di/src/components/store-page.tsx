import { component$ } from "@builder.io/qwik";
import { AppRoot } from "./app-root";

// 2 levels below the context provider.
export const StorePage = component$(() => {
  return <AppRoot />;
});
