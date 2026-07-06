import { Subscription } from "encore.dev/pubsub";

import { db } from "./db";
import { checkSite } from "./topics";

// Subscribe to the check-site topic to perform HTTP checks for each site
// and update the `is_up` flag in the database.
const _ = new Subscription(checkSite, "check-site", {
  handler: async (event) => {
    let isUp = false;
    try {
      const response = await fetch(event.url, { method: "GET" });
      isUp = response.status >= 200 && response.status < 300;
    } catch {
      // Any network / DNS / TLS error means the site is unreachable.
      isUp = false;
    }

    await db.exec`
      UPDATE sites
      SET is_up = ${isUp}
      WHERE id = ${event.id}
    `;
  },
});