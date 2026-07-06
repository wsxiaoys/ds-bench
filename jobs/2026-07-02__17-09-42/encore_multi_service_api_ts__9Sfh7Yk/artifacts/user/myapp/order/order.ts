import { api } from "encore.dev/api";
import { user } from "~encore/clients";

export interface OrderParams {
  id: number;
}

export interface OrderResponse {
  orderId: number;
  userId: number;
  userName: string;
}

// Returns an order by ID. Always fetches user ID 1 from the user service.
export const getOrder = api<OrderParams, OrderResponse>(
  { expose: true, method: "GET", path: "/order/:id" },
  async ({ id }) => {
    const u = await user.getUser({ id: 1 });
    return {
      orderId: id,
      userId: u.id,
      userName: u.name,
    };
  }
);