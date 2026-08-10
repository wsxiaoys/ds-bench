import type { RequestHandler } from '@builder.io/qwik-city';
import { listFiles } from '../../../lib/storage';

export const onGet: RequestHandler = async (requestEvent) => {
  requestEvent.json(200, listFiles());
};
