import { component$, useContext } from "@builder.io/qwik";
import { CartContext } from "~/context";

interface CartItemRowProps {
  id: string;
}

// 6 levels below the context provider. Only the plain `id` string is
// received as a prop; the item's reactive data and mutation capability come
// exclusively from useContext.
export const CartItemRow = component$((props: CartItemRowProps) => {
  const cart = useContext(CartContext);
  const item = cart.items.find((i) => i.id === props.id);

  if (!item) {
    return null;
  }

  return (
    <div data-testid={`item-${item.id}`} class="cart-item-row">
      <span class="cart-item-name">{item.name}</span>
      <span data-testid={`qty-${item.id}`}>{item.quantity}</span>
      <button
        data-testid={`dec-${item.id}`}
        onClick$={() => {
          const target = cart.items.find((i) => i.id === props.id);
          if (target && target.quantity > 0) {
            target.quantity -= 1;
          }
        }}
      >
        -
      </button>
      <button
        data-testid={`inc-${item.id}`}
        onClick$={() => {
          const target = cart.items.find((i) => i.id === props.id);
          if (target) {
            target.quantity += 1;
          }
        }}
      >
        +
      </button>
    </div>
  );
});
