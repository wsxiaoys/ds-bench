import { type RequestHandler } from '@builder.io/qwik-city';
import { getAllFiles } from '../../../lib/db.server';

export const onGet: RequestHandler = async ({ json }) => {
  const files = getAllFiles();
  json(200, files);
};
