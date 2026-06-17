import { api } from "encore.dev/api";
import { user } from "~encore/clients";

interface Order {
  orderId: number;
  userId: number;
  userName: string;
}

export const getOrder = api(
  { expose: true, method: "GET", path: "/order/:id" },
  async ({ id }: { id: number }): Promise<Order> => {
    const userId = 1;
    const userResp = await user.getUser({ id: userId });
    return { orderId: id, userId: userResp.id, userName: userResp.name };
  }
);
