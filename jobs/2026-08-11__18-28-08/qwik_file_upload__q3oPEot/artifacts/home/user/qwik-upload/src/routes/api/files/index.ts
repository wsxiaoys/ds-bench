import type { RequestHandler } from '@builder.io/qwik-city';

export const onGet: RequestHandler = async (requestEvent) => {
  const { getFiles } = await import('../../../lib/server-utils');
  const files = getFiles();
  requestEvent.json(200, files);
};
