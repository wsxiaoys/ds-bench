import { component$, Slot, useSignal, useStore, useContextProvider } from "@builder.io/qwik";
import { ThemeContext, CartContext, type CartStore } from "../context";

export default component$(() => {
  const theme = useSignal<"light" | "dark">("light");
  const cart = useStore<CartStore>({
    items: [
      { id: "sku-1", name: "Keyboard", price: 49.99, quantity: 1 },
      { id: "sku-2", name: "Mouse", price: 19.99, quantity: 2 },
    ],
  }, { deep: true });

  useContextProvider(ThemeContext, theme);
  useContextProvider(CartContext, cart);

  return <Slot />;
});
