import { Topic } from "encore.dev/pubsub";

// Event published for each site to be checked.
export interface CheckSiteEvent {
  id: number;
  url: string;
}

// Topic used to fan out check-site events.
export const checkSite = new Topic<CheckSiteEvent>("check-site", {
  deliveryGuarantee: "at-least-once",
});