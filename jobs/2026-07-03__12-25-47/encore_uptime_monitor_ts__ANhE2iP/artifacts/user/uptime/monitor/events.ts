import { Topic } from "encore.dev/pubsub";

export interface CheckEvent {
  siteId: number;
  url: string;
}

export const checkTopic = new Topic<CheckEvent>("check-site", {
  deliveryGuarantee: "at-least-once",
});
