import { RequestInfo } from "rwsdk/worker";

export const UserProfile = ({ params }: RequestInfo) => {
  return <p>User profile: {params.id}</p>;
};