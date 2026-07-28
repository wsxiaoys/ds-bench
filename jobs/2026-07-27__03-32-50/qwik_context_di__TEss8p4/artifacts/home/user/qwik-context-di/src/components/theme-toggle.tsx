import { component$, useContext } from "@builder.io/qwik";
import { ThemeContext } from "~/context";

// 5 levels below the context provider. Mutates the shared theme signal
// directly via useContext, no handler is passed down as a prop.
export const ThemeToggle = component$(() => {
  const theme = useContext(ThemeContext);

  return (
    <button
      data-testid="theme-toggle"
      onClick$={() => {
        theme.value = theme.value === "light" ? "dark" : "light";
      }}
    >
      Toggle Theme
    </button>
  );
});
