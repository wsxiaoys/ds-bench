defmodule Orchestra.Rollout.ReactorMiddleware do
  use Reactor.Middleware

  def init(context) do
    Orchestra.Rollout.Trace.record(:reactor_init, "reactor")
    {:ok, context}
  end

  def complete(result, _context) do
    Orchestra.Rollout.Trace.record(:reactor_complete, "reactor")
    {:ok, result}
  end

  def error(_errors, _context) do
    Orchestra.Rollout.Trace.record(:reactor_error, "reactor")
    :ok
  end

  def event(step_event, step, _context) do
    event_tag =
      case step_event do
        tag when is_atom(tag) -> tag
        tuple when is_tuple(tuple) -> elem(tuple, 0)
      end

    label = inspect(step.name)
    Orchestra.Rollout.Trace.record(event_tag, label)
    :ok
  end
end
