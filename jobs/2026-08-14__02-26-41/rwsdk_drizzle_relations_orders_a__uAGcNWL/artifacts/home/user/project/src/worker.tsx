import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { db } from "@/db/client";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/orders/:id", async ({ params }) => {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return Response.json(
        { error: "Order not found" },
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    try {
      const order = await db.query.orders.findFirst({
        where: (orders, { eq }) => eq(orders.id, id),
        with: {
          items: true,
        },
      });

      if (!order) {
        return Response.json(
          { error: "Order not found" },
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const responseBody = {
        id: order.id,
        customerName: order.customerName,
        status: order.status,
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      return Response.json(responseBody, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching order:", error);
      return Response.json(
        { error: "Internal Server Error" },
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
  render(Document, [route("/", Home)]),
]);
