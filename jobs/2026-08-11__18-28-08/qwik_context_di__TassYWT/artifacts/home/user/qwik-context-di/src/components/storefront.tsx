import { component$, useContext, useComputed$ } from "@builder.io/qwik";
import { ThemeContext, CartContext } from "../context";

export const Storefront = component$(() => {
  const theme = useContext(ThemeContext);
  const cart = useContext(CartContext);

  const aggregates = useComputed$(() => {
    let count = 0;
    let total = 0;
    for (const item of cart.items) {
      count += item.quantity;
      total += item.price * item.quantity;
    }
    return {
      count,
      total: `$${total.toFixed(2)}`
    };
  });

  return (
    <div data-testid="app-root" data-theme={theme.value} class="app-container">
      <header class="header">
        <h1 class="title">Storefront</h1>
        <div class="theme-controls">
          <span data-testid="theme-label">Theme: {theme.value}</span>
          <button
            data-testid="theme-toggle"
            onClick$={() => {
              theme.value = theme.value === "light" ? "dark" : "light";
            }}
          >
            Toggle Theme
          </button>
        </div>
      </header>

      <main class="main-content">
        <section class="cart-summary">
          <h2>Cart Summary</h2>
          <div class="summary-item">
            <span>Total Items: </span>
            <span data-testid="cart-count">{aggregates.value.count}</span>
          </div>
          <div class="summary-item">
            <span>Total Price: </span>
            <span data-testid="cart-total">{aggregates.value.total}</span>
          </div>
        </section>

        <section class="cart-items">
          <h2>Items</h2>
          <div class="items-list">
            {cart.items.map((item) => (
              <div
                key={item.id}
                data-testid={`item-${item.id}`}
                class="cart-item-row"
              >
                <span class="item-name">{item.name}</span>
                <span data-testid={`qty-${item.id}`} class="item-qty">
                  {item.quantity}
                </span>
                <div class="item-actions">
                  <button
                    data-testid={`inc-${item.id}`}
                    onClick$={() => {
                      const target = cart.items.find((i) => i.id === item.id);
                      if (target) {
                        target.quantity++;
                      }
                    }}
                  >
                    +
                  </button>
                  <button
                    data-testid={`dec-${item.id}`}
                    onClick$={() => {
                      const target = cart.items.find((i) => i.id === item.id);
                      if (target && target.quantity > 0) {
                        target.quantity--;
                      }
                    }}
                  >
                    -
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            data-testid="add-item"
            onClick$={() => {
              const exists = cart.items.some((i) => i.id === "sku-3");
              if (!exists) {
                cart.items.push({
                  id: "sku-3",
                  name: "Cable",
                  price: 9.99,
                  quantity: 1,
                });
              }
            }}
            class="add-btn"
          >
            Add Cable
          </button>
        </section>
      </main>
    </div>
  );
});
