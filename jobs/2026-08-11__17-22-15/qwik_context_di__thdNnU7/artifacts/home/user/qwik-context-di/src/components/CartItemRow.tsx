import { component$, useContext, $ } from "@builder.io/qwik";
import { CartContext } from "../context";

export interface CartItemRowProps {
  id: string;
}

export const CartItemRow = component$<CartItemRowProps>((props) => {
  const cartStore = useContext(CartContext);
  const item = cartStore.items.find((i) => i.id === props.id);

  if (!item) {
    return null;
  }

  const handleInc = $(() => {
    const target = cartStore.items.find((i) => i.id === props.id);
    if (target) {
      target.quantity += 1;
    }
  });

  const handleDec = $(() => {
    const target = cartStore.items.find((i) => i.id === props.id);
    if (target && target.quantity > 0) {
      target.quantity -= 1;
    }
  });

  return (
    <div data-testid={`item-${props.id}`}>
      <span>{item.name}</span>
      <span data-testid={`qty-${props.id}`}>{item.quantity}</span>
      <button data-testid={`inc-${props.id}`} onClick$={handleInc}>
        +
      </button>
      <button data-testid={`dec-${props.id}`} onClick$={handleDec}>
        -
      </button>
    </div>
  );
});
