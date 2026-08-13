import type { RequestHandler } from "@builder.io/qwik-city";
import { broker } from "../../../../../lib/db";

export const onGet: RequestHandler = async (event) => {
  const { params, json } = event;

  // 1. Validate room parameter
  const room = params.room;
  const roomRegex = /^[A-Za-z0-9_-]+$/;
  if (!room || !roomRegex.test(room)) {
    json(400, { error: "Invalid room name" });
    return;
  }

  // 2. Get subscriber count from the in-memory broker
  const count = broker.getSubscriberCount(room);

  // 3. Respond HTTP 200 with JSON
  json(200, {
    room,
    subscribers: count,
  });
};
