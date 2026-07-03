import type { RequestInfo } from "rwsdk/worker";

export const UserProfile = ({ params }: RequestInfo) => (
  <main>
    <p>User profile: {params.id}</p>
  </main>
);