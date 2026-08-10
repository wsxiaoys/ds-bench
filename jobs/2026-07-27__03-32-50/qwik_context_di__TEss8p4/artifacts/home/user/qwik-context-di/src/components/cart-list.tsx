import { component$, useContext } from "@builder.io/qwik";
import { CartContext } from "~/context";
import { CartItemRow } from "./cart-item-row";

// 5 levels below the context provider. Only plain id strings (never the
// store itself) are passed down to each row component.
export const CartList = component$(() => {
  const cart = useContext(CartContext);

  return (
    <div class="cart-list">
      {cart.items.map((item) => (
        <CartItemRow key={item.id} id={item.id} />
      ))}
    </div>
  );
});
