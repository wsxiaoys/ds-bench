import { component$, useContext } from "@builder.io/qwik";
import { ThemeContext } from "~/context";
import { ThemeSection } from "./theme-section";
import { CartSection } from "./cart-section";

// 3 levels below the context provider (routes/layout.tsx -> routes/index.tsx
// -> StorePage -> AppRoot). The theme value here is obtained exclusively via
// useContext, never through props.
export const AppRoot = component$(() => {
  const theme = useContext(ThemeContext);

  return (
    <div
      data-testid="app-root"
      data-theme={theme.value}
      class={`app-root theme-${theme.value}`}
    >
      <ThemeSection />
      <CartSection />
    </div>
  );
});
