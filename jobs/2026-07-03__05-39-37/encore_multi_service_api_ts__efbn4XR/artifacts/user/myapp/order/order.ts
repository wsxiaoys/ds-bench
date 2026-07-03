import { api } from "encore.dev/api";
import { user } from "~encore/clients";

export interface Order {
  orderId: number;
  userId: number;
  userName: string;
}

// getOrder returns an order by ID.
// It calls the user service internally to fetch the userName
// (always fetching the user with ID 1 for simplicity).
export const getOrder = api(
  { method: "GET", path: "/order/:id", expose: true },
  async (params: { id: number }): Promise<Order> => {
    // Call the user service internally to fetch the user with ID 1.
    const u = await user.getUser({ id: 1 });
    return {
      orderId: params.id,
      userId: u.id,
      userName: u.name,
    };
  }
);