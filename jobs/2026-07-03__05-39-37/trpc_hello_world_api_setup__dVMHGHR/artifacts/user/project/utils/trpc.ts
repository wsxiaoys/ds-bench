"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/routers/_app";

// Create the tRPC React Query client
export const trpc = createTRPCReact<AppRouter>();