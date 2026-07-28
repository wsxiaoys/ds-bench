import type { RequestHandler } from '@builder.io/qwik-city';

export const onGet: RequestHandler = async ({ json }) => {
  const { getFiles } = await import('../../../lib/storage');
  const files = getFiles();
  json(200, files);
};
