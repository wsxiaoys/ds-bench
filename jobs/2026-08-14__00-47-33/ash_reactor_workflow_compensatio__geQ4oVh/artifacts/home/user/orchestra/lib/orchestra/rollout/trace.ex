defmodule Orchestra.Rollout.Trace do
  use GenServer

  @name __MODULE__

  # Client API

  def start_link(init_arg) do
    GenServer.start_link(__MODULE__, init_arg, name: @name)
  end

  def reset do
    GenServer.call(@name, :reset)
  end

  def entries do
    GenServer.call(@name, :entries)
  end

  def record(event, label) do
    GenServer.call(@name, {:record, event, label})
  end

  # Server Callbacks

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
  def handle_call({:record, event, label}, _from, state) do
    {:reply, :ok, [{event, label} | state]}
  end
end
