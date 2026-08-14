defmodule Outbox.Eventing.SequenceServer do
  @moduledoc """
  A GenServer that manages event sequences and serializes event creation.
  """

  use GenServer

  alias Outbox.Eventing.Event

  def start_link(opts) do
    GenServer.start_link(__MODULE__, :ok, Keyword.put_new(opts, :name, __MODULE__))
  end

  @impl true
  def init(:ok) do
    {:ok, %{global_sequence: 0, aggregate_sequences: %{}}}
  end

  def create_event(attrs) do
    GenServer.call(__MODULE__, {:create_event, attrs})
  end

  def get_current_sequence() do
    GenServer.call(__MODULE__, :get_current_sequence)
  end

  def reset() do
    GenServer.call(__MODULE__, :reset)
  end

  @impl true
  def handle_call({:create_event, attrs}, _from, state) do
    global_seq = state.global_sequence + 1
    agg_key = "#{attrs.aggregate_type}:#{attrs.aggregate_id}"
    agg_seq = Map.get(state.aggregate_sequences, agg_key, 0) + 1

    dedup_key = "#{attrs.aggregate_type}:#{attrs.aggregate_id}:#{attrs.action}:#{agg_seq}"

    full_attrs =
      attrs
      |> Map.put(:sequence, global_seq)
      |> Map.put(:aggregate_sequence, agg_seq)
      |> Map.put(:dedup_key, dedup_key)

    case Ash.create(Event, full_attrs) do
      {:ok, event} ->
        new_state = %{
          state
          | global_sequence: global_seq,
            aggregate_sequences: Map.put(state.aggregate_sequences, agg_key, agg_seq)
        }
        {:reply, {:ok, event}, new_state}

      {:error, error} ->
        {:reply, {:error, error}, state}
    end
  end

  def handle_call(:get_current_sequence, _from, state) do
    {:reply, state.global_sequence, state}
  end

  def handle_call(:reset, _from, _state) do
    events =
      Event
      |> Ash.Query.new()
      |> Ash.read!()

    for event <- events do
      Ash.destroy!(event)
    end

    {:reply, :ok, %{global_sequence: 0, aggregate_sequences: %{}}}
  end
end
