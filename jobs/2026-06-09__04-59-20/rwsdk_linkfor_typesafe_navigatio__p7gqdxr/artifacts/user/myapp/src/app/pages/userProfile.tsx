import { RequestInfo } from "rwsdk/worker";

export const UserProfile = ({ params }: RequestInfo) => {
  return (
    <div>
      <p>User profile: {params.id}</p>
    </div>
  );
};
