import { api } from "encore.dev/api";

interface UserResponse {
    id: number;
    name: string;
}

export const getUser = api(
    { expose: true, method: "GET", path: "/user/:id" },
    async ({ id }: { id: number }): Promise<UserResponse> => {
        if (Number(id) === 1) {
            return { id: Number(id), name: "Alice" };
        }
        return { id: Number(id), name: "Unknown" };
    }
);
