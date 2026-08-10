import type { RequestHandler } from "@builder.io/qwik-city";
import { broker } from "~/lib/broker";

export const onGet: RequestHandler = async (ev) => {
  const room = ev.params.room;
  ev.json(200, {
    room,
    subscribers: broker.subscriberCount(room),
  });
};
