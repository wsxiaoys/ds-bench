import { api } from "encore.dev/api";
import { user } from "~encore/clients";

export const getOrder = api(
  { expose: true, method: "GET", path: "/order/:id" },
  async ({ id }: { id: number }): Promise<{ orderId: number; userId: number; userName: string }> => {
    const u = await user.getUser({ id: 1 });
    return { orderId: id, userId: 1, userName: u.name };
  }
);
