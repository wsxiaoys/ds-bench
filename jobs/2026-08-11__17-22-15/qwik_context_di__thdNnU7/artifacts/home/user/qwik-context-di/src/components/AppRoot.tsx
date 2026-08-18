import { component$, useContext, useComputed$, $ } from "@builder.io/qwik";
import { ThemeContext, CartContext } from "../context";
import { CartItemRow } from "./CartItemRow";

export const AppRoot = component$(() => {
  const theme = useContext(ThemeContext);
  const cartStore = useContext(CartContext);

  // Single useComputed$ to derive cart aggregates
  const aggregates = useComputed$(() => {
    let count = 0;
    let total = 0;
    for (const item of cartStore.items) {
      count += item.quantity;
      total += item.price * item.quantity;
    }
    return {
      count,
      total: `$${total.toFixed(2)}`,
    };
  });

  const toggleTheme = $(() => {
    theme.value = theme.value === "light" ? "dark" : "light";
  });

  const addItem = $(() => {
    const exists = cartStore.items.some((item) => item.id === "sku-3");
    if (!exists) {
      cartStore.items.push({
        id: "sku-3",
        name: "Cable",
        price: 9.99,
        quantity: 1,
      });
    }
  });

  return (
    <div data-testid="app-root" data-theme={theme.value}>
      <div>
        <span data-testid="theme-label">Theme: {theme.value}</span>
        <button data-testid="theme-toggle" onClick$={toggleTheme}>
          Toggle Theme
        </button>
      </div>

      <div>
        <h3>Cart Summary</h3>
        <div>
          Count: <span data-testid="cart-count">{aggregates.value.count}</span>
        </div>
        <div>
          Total: <span data-testid="cart-total">{aggregates.value.total}</span>
        </div>
      </div>

      <div>
        <h3>Cart Items</h3>
        {cartStore.items.map((item) => (
          <CartItemRow id={item.id} key={item.id} />
        ))}
      </div>

      <button data-testid="add-item" onClick$={addItem}>
        Add Item
      </button>
    </div>
  );
});
