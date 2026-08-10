import { createContextId } from "@builder.io/qwik";
import type { Signal } from "@builder.io/qwik";

export type Theme = "light" | "dark";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartStore {
  items: CartItem[];
}

/** Reactive theme value, either "light" or "dark". */
export const ThemeContext = createContextId<Signal<Theme>>(
  "app.theme-context",
);

/** Reactive store holding all cart items. */
export const CartContext = createContextId<CartStore>("app.cart-context");
