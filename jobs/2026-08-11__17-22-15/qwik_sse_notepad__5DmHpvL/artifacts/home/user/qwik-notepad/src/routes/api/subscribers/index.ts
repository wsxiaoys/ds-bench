import type { RequestHandler } from '@builder.io/qwik-city';
import { docState } from '../../../server/state';

export const onGet: RequestHandler = async (requestEvent) => {
  requestEvent.json(200, { count: docState.getSubscriberCount() });
};
