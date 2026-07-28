import {
  component$,
  Slot,
  useContextProvider,
  useSignal,
  useStore,
} from "@builder.io/qwik";
import { CartContext, ThemeContext, type CartStore, type Theme } from "~/context";

export default component$(() => {
  // Reactive theme value, shared through context with every descendant.
  const theme = useSignal<Theme>("light");

  // Reactive cart store, shared through context with every descendant.
  const cart = useStore<CartStore>({
    items: [
      { id: "sku-1", name: "Keyboard", price: 49.99, quantity: 1 },
      { id: "sku-2", name: "Mouse", price: 19.99, quantity: 2 },
    ],
  });

  // Provide both contexts exactly once, at the root route layout.
  useContextProvider(ThemeContext, theme);
  useContextProvider(CartContext, cart);

  return <Slot />;
});
