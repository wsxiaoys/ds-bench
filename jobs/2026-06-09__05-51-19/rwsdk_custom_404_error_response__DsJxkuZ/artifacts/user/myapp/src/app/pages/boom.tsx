import { ErrorResponse } from "rwsdk/worker";

export const boomHandler = () => {
  throw new ErrorResponse(418, "Short and stout");
};
