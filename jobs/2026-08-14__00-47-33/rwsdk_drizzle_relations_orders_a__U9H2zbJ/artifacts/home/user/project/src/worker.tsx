import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { eq } from "drizzle-orm";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { db } from "./db";
import { orders } from "./db/schema";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/orders/:id", async ({ params }) => {
    const orderId = Number(params.id);
    if (isNaN(orderId)) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        items: true,
      },
    });

    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 });
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
  render(Document, [route("/", Home)]),
]);
