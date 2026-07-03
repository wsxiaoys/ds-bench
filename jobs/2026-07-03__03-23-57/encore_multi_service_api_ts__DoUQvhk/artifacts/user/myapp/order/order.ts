import { api } from "encore.dev/api";
import { user } from "~encore/clients";

interface OrderResponse {
  orderId: number;
  userId: number;
  userName: string;
}

export const getOrder = api(
  { expose: true, method: "GET", path: "/order/:id" },
  async ({ id }: { id: number }): Promise<OrderResponse> => {
    // Call the user service internally to fetch the userName, hardcoded to ID 1.
    const userRes = await user.getUser({ id: 1 });
    return {
      orderId: id,
      userId: userRes.id,
      userName: userRes.name,
    };
  }
);
