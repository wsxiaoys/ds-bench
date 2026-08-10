import { component$ } from "@builder.io/qwik";
import { ThemeLabel } from "./theme-label";
import { ThemeToggle } from "./theme-toggle";

// 4 levels below the context provider.
export const ThemeSection = component$(() => {
  return (
    <section class="theme-section">
      <ThemeLabel />
      <ThemeToggle />
    </section>
  );
});
