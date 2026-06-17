export type Context = {
  userId: string;
};

export const createContext = async (opts: { req: Request }): Promise<Context> => {
  const userId = opts.req.headers.get("x-user-id") ?? "anonymous";

  return { userId };
};
