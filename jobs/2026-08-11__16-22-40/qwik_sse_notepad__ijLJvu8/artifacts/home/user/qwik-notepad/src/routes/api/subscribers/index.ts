import { type RequestHandler } from "@builder.io/qwik-city";
import { state } from "../../../state";

export const onGet: RequestHandler = async (requestEvent) => {
  requestEvent.json(200, { count: state.subscribers.size });
};
