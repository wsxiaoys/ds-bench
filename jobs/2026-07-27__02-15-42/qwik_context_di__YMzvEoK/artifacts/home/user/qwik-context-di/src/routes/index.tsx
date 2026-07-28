import { component$, useContext, useComputed$ } from "@builder.io/qwik";
import { ThemeContext, CartContext } from "./layout";

export const Level3 = component$(() => {
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
    <div data-testid="app-root" data-theme={theme.value}>
      <h1 data-testid="theme-label">Theme: {theme.value}</h1>
      <button
        data-testid="theme-toggle"
        onClick$={() => {
          theme.value = theme.value === "light" ? "dark" : "light";
        }}
      >
        Toggle Theme
      </button>

      <div>
        <h2>Cart</h2>
        <div>
          Total Items: <span data-testid="cart-count">{aggregates.value.count}</span>
        </div>
        <div>
          Total Price: <span data-testid="cart-total">{aggregates.value.total}</span>
        </div>

        <button
          data-testid="add-item"
          onClick$={() => {
            const exists = cart.items.some(item => item.id === "sku-3");
            if (!exists) {
              cart.items.push({
                id: "sku-3",
                name: "Cable",
                price: 9.99,
                quantity: 1
              });
            }
          }}
        >
          Add Cable
        </button>

        <div>
          {cart.items.map((item) => (
            <div key={item.id} data-testid={`item-${item.id}`}>
              <span>{item.name}</span>
              <span> - Qty: </span>
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
      </div>
    </div>
  );
});

export const Level2 = component$(() => {
  return <Level3 />;
});

export const Level1 = component$(() => {
  return <Level2 />;
});

export default component$(() => {
  return <Level1 />;
});
