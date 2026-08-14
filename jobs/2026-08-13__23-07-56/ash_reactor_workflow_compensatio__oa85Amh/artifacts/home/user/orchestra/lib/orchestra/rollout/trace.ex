defmodule Orchestra.Rollout.Trace do
  use Agent

  def start_link(_opts) do
    Agent.start_link(fn -> [] end, name: __MODULE__)
  end

  def reset do
    Agent.update(__MODULE__, fn _ -> [] end)
    :ok
  end

  def entries do
    Agent.get(__MODULE__, &Enum.reverse/1)
  end

  def record(event, label) do
    Agent.update(__MODULE__, fn list -> [{event, label} | list] end)
  end
end
