import { createContextId, type Signal } from "@builder.io/qwik";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartStore {
  items: CartItem[];
}

export const ThemeContext = createContextId<Signal<"light" | "dark">>("theme-context");
export const CartContext = createContextId<CartStore>("cart-context");
