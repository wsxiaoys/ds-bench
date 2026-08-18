import { component$, useContext, useComputed$ } from "@builder.io/qwik";
import { ThemeContext, CartContext } from "../context";

// Level 4: Storefront (consumes contexts)
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
    return { count, total };
  });

  return (
    <div data-testid="app-root" data-theme={theme.value}>
      <div data-testid="theme-label">Theme: {theme.value}</div>
      <button
        data-testid="theme-toggle"
        onClick$={() => {
          theme.value = theme.value === "light" ? "dark" : "light";
        }}
      >
        Toggle Theme
      </button>

      <div data-testid="cart-count">{aggregates.value.count}</div>
      <div data-testid="cart-total">${aggregates.value.total.toFixed(2)}</div>

      <div class="cart-items">
        {cart.items.map((item) => (
          <div key={item.id} data-testid={`item-${item.id}`}>
            <span>{item.name}</span>
            <span data-testid={`qty-${item.id}`}>{item.quantity}</span>
            <button
              data-testid={`inc-${item.id}`}
              onClick$={() => {
                item.quantity++;
              }}
            >
              +
            </button>
            <button
              data-testid={`dec-${item.id}`}
              onClick$={() => {
                if (item.quantity > 0) {
                  item.quantity--;
                }
              }}
            >
              -
            </button>
          </div>
        ))}
      </div>

      <button
        data-testid="add-item"
        onClick$={() => {
          const exists = cart.items.some((item) => item.id === "sku-3");
          if (!exists) {
            cart.items.push({
              id: "sku-3",
              name: "Cable",
              price: 9.99,
              quantity: 1,
            });
          }
        }}
      >
        Add Cable
      </button>
    </div>
  );
});

// Level 3: Level 3 component (nested 3 levels below layout)
export const Level3Component = component$(() => {
  return <Storefront />;
});

// Level 2: Level 2 component (nested 2 levels below layout)
export const Level2Component = component$(() => {
  return <Level3Component />;
});
