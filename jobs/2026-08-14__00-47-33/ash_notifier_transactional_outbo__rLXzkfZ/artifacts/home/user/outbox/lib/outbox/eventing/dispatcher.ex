defmodule Outbox.Eventing.Dispatcher do
  @moduledoc """
  The local event dispatcher GenServer.
  """

  use GenServer
  require Ash.Query

  defstruct [
    subscribers: [],
    global_counter: 0,
    aggregate_counters: %{},
    deliveries: %{}
  ]

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def subscribe(subscriber_id, pattern, handler, opts \\ []) do
    mode = Keyword.get(opts, :mode, :async)
    GenServer.call(__MODULE__, {:subscribe, subscriber_id, pattern, handler, mode})
  end

  def unsubscribe(subscriber_id) do
    GenServer.call(__MODULE__, {:unsubscribe, subscriber_id})
  end

  def flush() do
    GenServer.call(__MODULE__, :flush)
  end

  def dead_letters() do
    GenServer.call(__MODULE__, :dead_letters)
  end

  def reset() do
    GenServer.call(__MODULE__, :reset)
  end

  # --- GenServer Callbacks ---

  @impl true
  def init(_opts) do
    {:ok, %__MODULE__{}}
  end

  @impl true
  def handle_call({:subscribe, id, pattern, handler, mode}, _from, state) do
    if Enum.any?(state.subscribers, &(&1.id == id)) do
      {:reply, {:error, :already_subscribed}, state}
    else
      sub = %{
        id: id,
        pattern: pattern,
        handler: handler,
        mode: mode,
        subscribed_at_sequence: state.global_counter
      }
      new_subscribers = state.subscribers ++ [sub]
      {:reply, :ok, %{state | subscribers: new_subscribers}}
    end
  end

  @impl true
  def handle_call({:unsubscribe, id}, _from, state) do
    new_subscribers = Enum.reject(state.subscribers, &(&1.id == id))

    new_deliveries =
      state.deliveries
      |> Enum.reject(fn {{_seq, sub_id}, del} ->
        sub_id == id and del.status == :pending
      end)
      |> Map.new()

    {:reply, :ok, %{state | subscribers: new_subscribers, deliveries: new_deliveries}}
  end

  @impl true
  def handle_call({:assign_sequences, aggregate_type, aggregate_id}, _from, state) do
    global_counter = state.global_counter + 1
    agg_key = {aggregate_type, aggregate_id}
    agg_counter = Map.get(state.aggregate_counters, agg_key, 0) + 1
    new_agg_counters = Map.put(state.aggregate_counters, agg_key, agg_counter)

    new_state = %{
      state |
      global_counter: global_counter,
      aggregate_counters: new_agg_counters
    }

    {:reply, {:ok, global_counter, agg_counter}, new_state}
  end

  @impl true
  def handle_call({:get_matching_subscribers, topic, sequence}, _from, state) do
    matching =
      Enum.filter(state.subscribers, fn sub ->
        Outbox.Eventing.match_topic?(sub.pattern, topic) and sequence > sub.subscribed_at_sequence
      end)

    {:reply, matching, state}
  end

  @impl true
  def handle_call({:get_subscriber, subscriber_id}, _from, state) do
    sub = Enum.find(state.subscribers, &(&1.id == subscriber_id))
    {:reply, sub, state}
  end

  @impl true
  def handle_call({:record_sync_delivery, sequence, subscriber_id, result}, _from, state) do
    key = {sequence, subscriber_id}
    delivery =
      case result do
        :ok ->
          %{attempts: 1, status: :acknowledged, reason: nil}
        {:error, reason} ->
          %{attempts: 1, status: :pending, reason: reason}
        {:raised, e} ->
          %{attempts: 1, status: :pending, reason: {:raised, Exception.message(e)}}
      end

    new_deliveries = Map.put(state.deliveries, key, delivery)
    {:reply, :ok, %{state | deliveries: new_deliveries}}
  end

  @impl true
  def handle_call({:record_async_delivery, sequence, subscriber_id}, _from, state) do
    key = {sequence, subscriber_id}
    delivery = %{attempts: 0, status: :pending, reason: nil}
    new_deliveries = Map.put(state.deliveries, key, delivery)
    {:reply, :ok, %{state | deliveries: new_deliveries}}
  end

  @impl true
  def handle_call(:flush, _from, state) do
    pending_deliveries =
      state.deliveries
      |> Enum.filter(fn {_, del} -> del.status == :pending end)
      |> Enum.sort_by(fn {{seq, sub_id}, _del} ->
        sub_index = Enum.find_index(state.subscribers, &(&1.id == sub_id))
        {seq, sub_index}
      end)

    new_state =
      Enum.reduce(pending_deliveries, state, fn {{seq, sub_id}, del}, acc_state ->
        subscriber = Enum.find(acc_state.subscribers, &(&1.id == sub_id))

        if is_nil(subscriber) do
          new_dels = Map.delete(acc_state.deliveries, {seq, sub_id})
          %{acc_state | deliveries: new_dels}
        else
          event =
            Outbox.Eventing.Event
            |> Ash.Query.filter(sequence == ^seq)
            |> Ash.read_one!()

          if is_nil(event) do
            acc_state
          else
            attempts = del.attempts + 1
            new_del =
              try do
                case subscriber.handler.(event) do
                  :ok ->
                    %{del | attempts: attempts, status: :acknowledged, reason: nil}

                  {:error, reason} ->
                    if attempts >= 3 do
                      %{del | attempts: attempts, status: :dead_letter, reason: reason}
                    else
                      %{del | attempts: attempts, status: :pending, reason: reason}
                    end
                end
              rescue
                e ->
                  reason = {:raised, Exception.message(e)}
                  if attempts >= 3 do
                    %{del | attempts: attempts, status: :dead_letter, reason: reason}
                  else
                    %{del | attempts: attempts, status: :pending, reason: reason}
                  end
              catch
                kind, value ->
                  reason = {:raised, "caught #{inspect(kind)}: #{inspect(value)}"}
                  if attempts >= 3 do
                    %{del | attempts: attempts, status: :dead_letter, reason: reason}
                  else
                    %{del | attempts: attempts, status: :pending, reason: reason}
                  end
              end

            new_dels = Map.put(acc_state.deliveries, {seq, sub_id}, new_del)
            %{acc_state | deliveries: new_dels}
          end
        end
      end)

    {:reply, :ok, new_state}
  end

  @impl true
  def handle_call(:dead_letters, _from, state) do
    dead =
      state.deliveries
      |> Enum.filter(fn {_, del} -> del.status == :dead_letter end)
      |> Enum.sort_by(fn {{seq, sub_id}, _del} ->
        sub_index = Enum.find_index(state.subscribers, &(&1.id == sub_id))
        {seq, sub_index}
      end)
      |> Enum.map(fn {{seq, sub_id}, del} ->
        %{
          subscriber_id: sub_id,
          sequence: seq,
          attempts: del.attempts,
          reason: del.reason
        }
      end)

    {:reply, dead, state}
  end

  @impl true
  def handle_call(:reset, _from, _state) do
    events = Outbox.Eventing.list_events!()
    Ash.bulk_destroy!(events, :destroy, %{}, domain: Outbox.Eventing)

    new_state = %__MODULE__{
      subscribers: [],
      global_counter: 0,
      aggregate_counters: %{},
      deliveries: %{}
    }

    {:reply, :ok, new_state}
  end
end
