import { component$, useComputed$, useContext } from "@builder.io/qwik";
import { CartContext } from "~/context";

// 5 levels below the context provider. The single useComputed$ in this
// application derives both cart aggregates (count and total price) from the
// injected cart store, obtained exclusively via useContext.
export const CartSummary = component$(() => {
  const cart = useContext(CartContext);

  const aggregates = useComputed$(() => {
    let count = 0;
    let total = 0;

    for (const item of cart.items) {
      count += item.quantity;
      total += item.price * item.quantity;
    }

    return { count, total };
  });

  return (
    <div class="cart-summary">
      <span data-testid="cart-count">{aggregates.value.count}</span>
      <span data-testid="cart-total">${aggregates.value.total.toFixed(2)}</span>
    </div>
  );
});
