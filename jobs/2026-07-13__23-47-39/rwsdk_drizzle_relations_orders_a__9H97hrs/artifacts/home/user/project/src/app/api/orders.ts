import { route } from "rwsdk/router";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

// GET /api/orders/:id
// Returns a single order together with its nested line items as JSON.
export const orderRoutes = [
  route("/api/orders/:id", async ({ params }) => {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return Response.json({ error: "Invalid order id" }, { status: 400 });
    }

    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
      with: { items: true },
    });

    if (!order) {
      return Response.json({ error: `Order ${id} not found` }, { status: 404 });
    }

    return Response.json({
      id: order.id,
      customerName: order.customerName,
      status: order.status,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });
  }),
];