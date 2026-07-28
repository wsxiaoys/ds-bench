import { component$ } from "@builder.io/qwik";
import { CartSummary } from "./cart-summary";
import { CartList } from "./cart-list";
import { AddItemButton } from "./add-item-button";

// 4 levels below the context provider.
export const CartSection = component$(() => {
  return (
    <section class="cart-section">
      <CartSummary />
      <CartList />
      <AddItemButton />
    </section>
  );
});
