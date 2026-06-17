import { api } from "encore.dev/api";
import { user } from "~encore/clients";

interface Order {
  orderId: number;
  userId: number;
  userName: string;
}

export const getOrder = api(
  { method: "GET", path: "/order/:id" },
  async ({ id }: { id: number }): Promise<Order> => {
    const userInfo = await user.getUser({ id: 1 });

    return {
      orderId: id,
      userId: userInfo.id,
      userName: userInfo.name,
    };
  }
);
