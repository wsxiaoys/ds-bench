defmodule Orchestra.Rollout.Middleware do
  use Reactor.Middleware

  @impl true
  def init(context) do
    Orchestra.Rollout.Trace.record(:reactor_init, "reactor")
    {:ok, context}
  end

  @impl true
  def complete(result, _context) do
    Orchestra.Rollout.Trace.record(:reactor_complete, "reactor")
    {:ok, result}
  end

  @impl true
  def error(_error_or_errors, _context) do
    Orchestra.Rollout.Trace.record(:reactor_error, "reactor")
    :ok
  end

  @impl true
  def event(step_event, step, _context) do
    tag = get_event_tag(step_event)
    label = inspect(step.name)
    Orchestra.Rollout.Trace.record(tag, label)
    :ok
  end

  defp get_event_tag(tuple) when is_tuple(tuple), do: elem(tuple, 0)
  defp get_event_tag(atom) when is_atom(atom), do: atom
end
