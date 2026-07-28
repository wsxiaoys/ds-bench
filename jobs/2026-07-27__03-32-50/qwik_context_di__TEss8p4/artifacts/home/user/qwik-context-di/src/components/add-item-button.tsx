import { component$, useContext } from "@builder.io/qwik";
import { CartContext } from "~/context";

// 5 levels below the context provider. Mutates the injected cart store
// directly; no handler is lifted to the provider.
export const AddItemButton = component$(() => {
  const cart = useContext(CartContext);

  return (
    <button
      data-testid="add-item"
      onClick$={() => {
        const exists = cart.items.some((item) => item.id === "sku-3");
        if (!exists) {
          cart.items.push({ id: "sku-3", name: "Cable", price: 9.99, quantity: 1 });
        }
      }}
    >
      Add Cable
    </button>
  );
});
