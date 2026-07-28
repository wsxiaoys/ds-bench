import { component$, useContext } from "@builder.io/qwik";
import { ThemeContext } from "~/context";

// 5 levels below the context provider. Consumes the theme exclusively via
// useContext.
export const ThemeLabel = component$(() => {
  const theme = useContext(ThemeContext);

  return <div data-testid="theme-label">Theme: {theme.value}</div>;
});
