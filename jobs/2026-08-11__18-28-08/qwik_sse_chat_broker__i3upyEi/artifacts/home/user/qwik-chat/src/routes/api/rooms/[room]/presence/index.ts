import type { RequestHandler } from "@builder.io/qwik-city";
import { getSubscriberCount } from "~/lib/chat";

export const onGet: RequestHandler = async (ev) => {
  const { params, json } = ev;
  const room = params.room;

  // Validate room parameter
  if (!room || !/^[A-Za-z0-9_-]+$/.test(room)) {
    json(400, { error: "Invalid room name" });
    return;
  }

  json(200, {
    room,
    subscribers: getSubscriberCount(room)
  });
};
