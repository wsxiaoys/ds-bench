import { api } from "encore.dev/api";
import { user } from "~encore/clients";

interface OrderResponse {
  orderId: number;
  userId: number;
  userName: string;
}

export const get = api(
  { expose: true, method: "GET", path: "/order/:id" },
  async ({ id }: { id: number }): Promise<OrderResponse> => {
    const u = await user.get({ id: 1 });
    return {
      orderId: id,
      userId: u.id,
      userName: u.name,
    };
  }
);
