import { api } from "encore.dev/api";
import { user } from "~encore/clients";

interface OrderParams {
  id: number;
}

interface OrderResponse {
  orderId: number;
  userId: number;
  userName: string;
}

export const getOrder = api(
  { expose: true, method: "GET", path: "/order/:id" },
  async ({ id }: OrderParams): Promise<OrderResponse> => {
    // Hardcoded to always fetch user with ID 1
    const userInfo = await user.getUser({ id: 1 });
    return {
      orderId: id,
      userId: 1,
      userName: userInfo.name,
    };
  }
);