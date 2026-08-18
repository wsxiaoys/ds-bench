import type { RequestHandler } from '@builder.io/qwik-city';
import { broker } from '~/lib/broker';

export const onGet: RequestHandler = async ({ params, json }) => {
  const room = params.room;
  if (!room || !/^[A-Za-z0-9_-]+$/.test(room)) {
    json(400, { error: "Invalid room name" });
    return;
  }

  const count = broker.getSubscriberCount(room);

  json(200, {
    room,
    subscribers: count
  });
};
