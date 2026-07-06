import { type } from "arktype";

export const IdleState = type({
  status: "'idle'"
});

export const LoadingState = type({
  status: "'loading'",
  startedAt: "number.integer >= 0"
});

export const SuccessState = type({
  status: "'success'",
  data: "unknown",
  fetchedAt: "number.integer >= 0"
});

export const FailureState = type({
  status: "'failure'",
  code: "number.integer >= 400 & number.integer <= 599",
  reason: "string >= 1 & string <= 200"
});

export const State = IdleState.or(LoadingState).or(SuccessState).or(FailureState);

export type State = typeof State.infer;

export const StartEvent = type({
  type: "'start'",
  at: "number"
});

export const ResolveEvent = type({
  type: "'resolve'",
  data: "unknown",
  at: "number"
});

export const RejectEvent = type({
  type: "'reject'",
  code: "number.integer",
  reason: "string",
  at: "number"
});

export const ResetEvent = type({
  type: "'reset'"
});

export const Event = StartEvent.or(ResolveEvent).or(RejectEvent).or(ResetEvent);

export type Event = typeof Event.infer;

export const transition = type.fn(State, Event, ":", State)((state, event) => {
  if (event.type === "reset") {
    return { status: "idle" };
  }

  if (state.status === "idle" && event.type === "start") {
    return {
      status: "loading",
      startedAt: Math.trunc(event.at)
    };
  }

  if (state.status === "loading") {
    if (event.type === "resolve") {
      return {
        status: "success",
        data: event.data,
        fetchedAt: Math.trunc(event.at)
      };
    }
    if (event.type === "reject") {
      return {
        status: "failure",
        code: event.code,
        reason: event.reason
      };
    }
  }

  return state;
});
