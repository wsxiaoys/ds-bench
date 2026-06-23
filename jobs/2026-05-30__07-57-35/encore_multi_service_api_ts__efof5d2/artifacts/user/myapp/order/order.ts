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
        const u = await user.getUser({ id: 1 });
        return {
            orderId: Number(id),
            userId: 1,
            userName: u.name,
        };
    }
);
