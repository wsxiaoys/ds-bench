import { Service } from "encore.dev/service";

// Defines the "auth" service that owns the authentication handler
// and the API Gateway used to process incoming requests.
export default new Service("auth");