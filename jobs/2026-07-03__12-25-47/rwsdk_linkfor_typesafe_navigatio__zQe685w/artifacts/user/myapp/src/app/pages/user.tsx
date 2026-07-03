import type { RequestInfo } from "rwsdk/worker";

export const UserProfile = ({ params }: RequestInfo) => {
  return (
    <div>
      <h1>User profile: {params.id}</h1>
    </div>
  );
};
