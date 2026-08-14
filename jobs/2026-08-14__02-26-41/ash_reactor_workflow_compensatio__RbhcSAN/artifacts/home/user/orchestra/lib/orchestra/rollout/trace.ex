defmodule Orchestra.Rollout.Trace do
  use GenServer

  # API

  def start_link(init_arg) do
    GenServer.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  def reset do
    GenServer.call(__MODULE__, :reset)
  end

  def entries do
    GenServer.call(__MODULE__, :entries)
  end

  def record(event, label) when is_atom(event) and is_binary(label) do
    GenServer.cast(__MODULE__, {:record, event, label})
  end

  # Callbacks

  @impl true
  def init(_init_arg) do
    {:ok, []}
  end

  @impl true
  def handle_call(:reset, _from, _state) do
    {:reply, :ok, []}
  end

  @impl true
  def handle_call(:entries, _from, state) do
    {:reply, Enum.reverse(state), state}
  end

  @impl true
  def handle_cast({:record, event, label}, state) do
    {:noreply, [{event, label} | state]}
  end
end

defmodule Orchestra.Rollout.Trace.Middleware do
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
  def error(_errors, _context) do
    Orchestra.Rollout.Trace.record(:reactor_error, "reactor")
    :ok
  end

  @impl true
  def event(event, step, _context) do
    tag = case event do
      tuple when is_tuple(tuple) -> elem(tuple, 0)
      atom when is_atom(atom) -> atom
    end
    label = inspect(step.name)
    Orchestra.Rollout.Trace.record(tag, label)
    :ok
  end
end
