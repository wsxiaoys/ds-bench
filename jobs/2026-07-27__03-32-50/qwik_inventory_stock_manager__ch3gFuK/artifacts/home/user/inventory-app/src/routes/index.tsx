import { component$ } from "@builder.io/qwik";
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";

export const useProducts = routeLoader$(async () => {
  // Import kept inside the loader closure so the sqlite module never
  // ends up in the client bundle.
  const { listProductsWithQuantity } = await import("~/lib/db");
  return listProductsWithQuantity();
});

export const useMovementAction = routeAction$(
  async (data, { fail }) => {
    const { applyMovement } = await import("~/lib/db");

    const result = applyMovement(data.productId, data.type, data.quantity);

    if (!result.ok) {
      return fail(400, { message: result.error });
    }

    return { success: true as const };
  },
  zod$({
    productId: z.coerce
      .number({ invalid_type_error: "Product is required." })
      .int("Product id must be an integer.")
      .positive("Product id must be positive."),
    type: z.enum(["receive", "ship"], {
      errorMap: () => ({ message: "Type must be either receive or ship." }),
    }),
    quantity: z.coerce
      .number({ invalid_type_error: "Quantity must be a number." })
      .int("Quantity must be an integer.")
      .positive("Quantity must be a positive integer."),
  }),
);

// The action's failure shape is either our own `{ message }` (business-rule
// rejection, e.g. insufficient stock / unknown product) or the zod$
// validator's `{ fieldErrors, formErrors }` (malformed input). Normalize
// both into a single human-readable string for the `data-testid="error"`
// element.
function formatActionError(value: unknown): string {
  if (value && typeof value === "object") {
    const v = value as {
      message?: string;
      formErrors?: string[];
      fieldErrors?: Record<string, string[] | undefined>;
    };

    if (v.message) {
      return v.message;
    }

    const messages: string[] = [];
    if (v.formErrors?.length) {
      messages.push(...v.formErrors);
    }
    if (v.fieldErrors) {
      for (const errors of Object.values(v.fieldErrors)) {
        if (errors?.length) {
          messages.push(...errors);
        }
      }
    }
    if (messages.length) {
      return messages.join(" ");
    }
  }
  return "Submission failed.";
}

export default component$(() => {
  const products = useProducts();
  const action = useMovementAction();

  return (
    <>
      <h1>Inventory Stock Manager</h1>

      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Name</th>
            <th>On hand</th>
          </tr>
        </thead>
        <tbody>
          {products.value.map((p) => (
            <tr key={p.id} data-testid={`product-${p.id}`}>
              <td>{p.sku}</td>
              <td>{p.name}</td>
              <td data-testid={`qty-${p.id}`}>{p.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Form action={action} data-testid="movement-form">
        <label>
          Product
          <select name="productId">
            {products.value.map((p) => (
              <option key={p.id} value={p.id}>
                {`${p.sku} - ${p.name}`}
              </option>
            ))}
          </select>
        </label>

        <label>
          Type
          <select name="type">
            <option value="receive">Receive</option>
            <option value="ship">Ship</option>
          </select>
        </label>

        <label>
          Quantity
          <input type="number" name="quantity" min="1" step="1" />
        </label>

        <button type="submit">Submit</button>
      </Form>

      {action.value?.failed && (
        <div data-testid="error">{formatActionError(action.value)}</div>
      )}
    </>
  );
});

export const head: DocumentHead = {
  title: "Inventory Stock Manager",
  meta: [
    {
      name: "description",
      content: "Server-authoritative inventory stock management",
    },
  ],
};
