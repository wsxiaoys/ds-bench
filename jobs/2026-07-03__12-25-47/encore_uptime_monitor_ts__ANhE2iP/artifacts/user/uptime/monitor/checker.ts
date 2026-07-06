import { Subscription } from "encore.dev/pubsub";
import { db } from "./db";
import { checkTopic, CheckEvent } from "./events";

new Subscription(checkTopic, "check-site", {
  handler: async (event: CheckEvent) => {
    let isUp = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(event.url, { method: "GET", signal: controller.signal });
      clearTimeout(timeout);
      isUp = res.status >= 200 && res.status < 300;
    } catch (err) {
      isUp = false;
    }
    await db.exec`
      UPDATE sites SET is_up = ${isUp} WHERE id = ${event.siteId}
    `;
  },
});
