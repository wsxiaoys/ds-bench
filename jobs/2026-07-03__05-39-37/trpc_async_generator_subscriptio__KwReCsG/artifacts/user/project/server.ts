import { initTRPC } from '@trpc/server';
import {
  fastifyTRPCPlugin,
  FastifyTRPCPluginOptions,
} from '@trpc/server/adapters/fastify';
import fastify from 'fastify';
import { z } from 'zod';

const t = initTRPC.create();

export const appRouter = t.router({
  countdown: t.procedure
    .input(z.number().int().min(0))
    .subscription(async function* (opts) {
      let count = opts.input;
      while (count >= 0) {
        yield count;
        await new Promise((resolve) => setTimeout(resolve, 100));
        count--;
      }
    }),
});

export type AppRouter = typeof appRouter;

const server = fastify({
  maxParamLength: 5000,
});

await server.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
  } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
});

try {
  await server.listen({ port: 3000, host: '0.0.0.0' });
  console.log('tRPC server listening on http://localhost:3000/trpc');
} catch (err) {
  server.log.error(err);
  process.exit(1);
}