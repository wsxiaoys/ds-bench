import type { RequestHandler } from "@builder.io/qwik-city";
import { broker } from "../../../../../lib/state";

export const onGet: RequestHandler = async (requestEvent) => {
  const room = requestEvent.params.room;
  if (!room || !/^[A-Za-z0-9_-]+$/.test(room)) {
    requestEvent.json(400, { error: "Invalid room name" });
    return;
  }

  const subscribers = broker.getPresence(room);

  requestEvent.json(200, {
    room,
    subscribers,
  });
};
