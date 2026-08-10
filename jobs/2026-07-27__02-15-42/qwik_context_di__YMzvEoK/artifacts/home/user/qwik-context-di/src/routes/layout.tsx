import { component$, Slot, useSignal, useStore, useContextProvider, createContextId, Signal } from "@builder.io/qwik";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartStore {
  items: CartItem[];
}

export type ThemeValue = "light" | "dark";

export const ThemeContext = createContextId<Signal<ThemeValue>>("theme-context");
export const CartContext = createContextId<CartStore>("cart-context");

export default component$(() => {
  const theme = useSignal<ThemeValue>("light");
  const cart = useStore<CartStore>({
    items: [
      { id: "sku-1", name: "Keyboard", price: 49.99, quantity: 1 },
      { id: "sku-2", name: "Mouse", price: 19.99, quantity: 2 }
    ]
  }, { deep: true });

  useContextProvider(ThemeContext, theme);
  useContextProvider(CartContext, cart);

  return <Slot />;
});
