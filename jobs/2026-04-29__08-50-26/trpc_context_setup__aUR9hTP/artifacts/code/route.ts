import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/trpc/router';
import type { Context } from '@/trpc/init';

/**
 * Create context for tRPC procedures
 * Extracts the x-user-id header from the incoming request
 */
async function createContext(req: Request): Promise<Context> {
  // Extract the x-user-id header from the request
  const userId = req.headers.get('x-user-id') || 'anonymous';
  
  return {
    userId,
  };
}

/**
 * tRPC API route handler for Next.js App Router
 * Uses fetchRequestHandler to handle tRPC requests
 */
export async function GET(req: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext(req),
  });
}

/**
 * tRPC API route handler for POST requests
 */
export async function POST(req: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext(req),
  });
}