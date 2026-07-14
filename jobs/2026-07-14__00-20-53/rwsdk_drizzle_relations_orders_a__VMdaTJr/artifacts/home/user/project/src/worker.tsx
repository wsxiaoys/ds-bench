import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { orders } from "@/db/schema";

export type AppContext = {};

const getOrder = async ({ params }: { params: { id: string } }) => {
  const orderId = Number(params.id);
  if (!Number.isFinite(orderId)) {
    return new Response(
      JSON.stringify({ error: "Invalid order id" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      items: true,
    },
  });

  if (!order) {
    return new Response(
      JSON.stringify({ error: "Order not found" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      id: order.id,
      customerName: order.customerName,
      status: order.status,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [route("/", Home), route("/api/orders/:id", getOrder)]),
]);
