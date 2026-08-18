import {
  component$,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";

interface Item {
  id: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

interface OrderStore {
  items: Item[];
  couponApplied: boolean;
  totalCents: number;
}

function formatCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

export default component$(() => {
  const store = useStore<OrderStore>({
    items: [
      { id: "keyboard", name: "Keyboard", unitPriceCents: 4999, quantity: 1 },
      { id: "mouse", name: "Mouse", unitPriceCents: 2550, quantity: 2 },
      { id: "monitor", name: "Monitor", unitPriceCents: 19900, quantity: 1 },
    ],
    couponApplied: false,
    totalCents: 0,
  });

  const autoRestock = useSignal(false);

  // Keep the displayed total in sync with the order.
  useTask$(({ track }) => {
    track(() => store.couponApplied);
    for (const item of store.items) {
      track(() => item.quantity);
    }
    const subtotal = store.items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );
    store.totalCents = store.couponApplied
      ? Math.round(subtotal * 0.9)
      : subtotal;
  });

  // Auto-restock: repeatedly bump the Mouse quantity while enabled.
  useVisibleTask$(({ track, cleanup }) => {
    const enabled = track(() => autoRestock.value);
    if (!enabled) {
      return;
    }
    const id = setInterval(() => {
      const mouse = store.items.find((i) => i.id === "mouse");
      if (mouse) {
        mouse.quantity++;
      }
    }, 500);
    cleanup(() => clearInterval(id));
  });

  return (
    <main>
      <h1>Order Summary</h1>
      <ul>
        {store.items.map((item) => (
          <li key={item.id}>
            <span>{item.name}</span>{" "}
            <button
              data-testid={`dec-${item.id}`}
              onClick$={() => {
                if (item.quantity > 0) item.quantity--;
              }}
            >
              -
            </button>{" "}
            <span data-testid={`qty-${item.id}`}>{item.quantity}</span>{" "}
            <button
              data-testid={`inc-${item.id}`}
              onClick$={() => item.quantity++}
            >
              +
            </button>
          </li>
        ))}
      </ul>

      <label>
        <input
          type="checkbox"
          data-testid="coupon"
          checked={store.couponApplied}
          onChange$={(_, el) => (store.couponApplied = el.checked)}
        />{" "}
        Apply 10% coupon
      </label>

      <p>
        Total: <span data-testid="total">{formatCents(store.totalCents)}</span>
      </p>

      <button
        data-testid="auto-toggle"
        onClick$={() => (autoRestock.value = !autoRestock.value)}
      >
        {autoRestock.value ? "Stop auto-restock" : "Start auto-restock"}
      </button>
    </main>
  );
});
