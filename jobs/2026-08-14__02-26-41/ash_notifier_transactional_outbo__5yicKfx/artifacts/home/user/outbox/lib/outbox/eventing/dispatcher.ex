defmodule Outbox.Eventing.Dispatcher do
  @moduledoc """
  A supervised, long-lived process that fans entries out to subscribers.
  """

  use GenServer
  require Ash.Query

  alias Outbox.Eventing.Event

  defstruct [
    subscribers: [], # list of subscriber maps
    pending_deliveries: %{}, # map of {subscriber_id, sequence} -> delivery map
    dead_letters: %{}, # map of {subscriber_id, sequence} -> dead letter map
    global_sequence: 0,
    aggregate_sequences: %{}, # map of {aggregate_type, aggregate_id} -> aggregate_sequence
    subscriber_indices: %{}, # map of subscriber_id -> registration index
    subscriber_index_counter: 0
  ]

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Subscribe a handler to a topic pattern.
  """
  def subscribe(subscriber_id, pattern, handler, opts \\ []) do
    GenServer.call(__MODULE__, {:subscribe, subscriber_id, pattern, handler, opts})
  end

  @doc """
  Unsubscribe a subscriber.
  """
  def unsubscribe(subscriber_id) do
    GenServer.call(__MODULE__, {:unsubscribe, subscriber_id})
  end

  @doc """
  Perform exactly one drain pass.
  """
  def flush do
    GenServer.call(__MODULE__, :flush)
  end

  @doc """
  Return all dead letters.
  """
  def dead_letters do
    GenServer.call(__MODULE__, :dead_letters)
  end

  @doc """
  Reset the whole subsystem to pristine state.
  """
  def reset do
    GenServer.call(__MODULE__, :reset)
  end

  # --- Internal APIs for Notifier & Replay ---

  def register_event(notification) do
    GenServer.call(__MODULE__, {:register_event, notification})
  end

  def acknowledge_delivery(subscriber_id, sequence) do
    GenServer.call(__MODULE__, {:acknowledge_delivery, subscriber_id, sequence})
  end

  def fail_delivery(subscriber_id, sequence, reason) do
    GenServer.call(__MODULE__, {:fail_delivery, subscriber_id, sequence, reason})
  end

  def get_subscriber(subscriber_id) do
    GenServer.call(__MODULE__, {:get_subscriber, subscriber_id})
  end

  # --- Server Callbacks ---

  @impl true
  def init(_opts) do
    {:ok, %__MODULE__{}}
  end

  @impl true
  def handle_call({:subscribe, subscriber_id, pattern, handler, opts}, _from, state) do
    if Enum.any?(state.subscribers, &(&1.id == subscriber_id)) do
      {:reply, {:error, :already_subscribed}, state}
    else
      mode = Keyword.get(opts, :mode, :async)
      new_counter = state.subscriber_index_counter + 1

      subscriber = %{
        id: subscriber_id,
        pattern: pattern,
        handler: handler,
        mode: mode,
        subscribed_at_sequence: state.global_sequence,
        registration_index: new_counter
      }

      new_subscribers = state.subscribers ++ [subscriber]
      new_indices = Map.put(state.subscriber_indices, subscriber_id, new_counter)

      new_state = %{state |
        subscribers: new_subscribers,
        subscriber_indices: new_indices,
        subscriber_index_counter: new_counter
      }

      {:reply, :ok, new_state}
    end
  end

  @impl true
  def handle_call({:unsubscribe, subscriber_id}, _from, state) do
    new_subscribers = Enum.reject(state.subscribers, &(&1.id == subscriber_id))
    new_pending = Map.reject(state.pending_deliveries, fn {{sub_id, _seq}, _del} -> sub_id == subscriber_id end)

    new_state = %{state |
      subscribers: new_subscribers,
      pending_deliveries: new_pending
    }

    {:reply, :ok, new_state}
  end

  @impl true
  def handle_call(:flush, _from, state) do
    # Sort pending deliveries by sequence ascending, then by subscriber registration index
    sorted_pending =
      state.pending_deliveries
      |> Map.values()
      |> Enum.sort_by(fn delivery ->
        sub_idx = Map.get(state.subscriber_indices, delivery.subscriber_id, 999999)
        {delivery.sequence, sub_idx}
      end)

    new_state =
      Enum.reduce(sorted_pending, state, fn delivery, acc_state ->
        key = {delivery.subscriber_id, delivery.sequence}

        # Ensure delivery is still pending (not unsubscribed or concurrently modified)
        if Map.has_key?(acc_state.pending_deliveries, key) do
          subscriber = Enum.find(acc_state.subscribers, &(&1.id == delivery.subscriber_id))

          if subscriber do
            # Fetch the event record
            event =
              Event
              |> Ash.Query.filter(sequence == ^delivery.sequence)
              |> Ash.read!()
              |> List.first()

            if event do
              result =
                try do
                  subscriber.handler.(event)
                rescue
                  e ->
                    {:raised, Exception.message(e)}
                catch
                  kind, value ->
                    {:raised, "caught #{inspect(kind)}: #{inspect(value)}"}
                end

              case result do
                :ok ->
                  # Acknowledged! Remove from pending
                  new_pending = Map.delete(acc_state.pending_deliveries, key)
                  %{acc_state | pending_deliveries: new_pending}

                {:error, reason} ->
                  update_failed_delivery(acc_state, delivery.subscriber_id, delivery.sequence, reason)

                {:raised, _msg} = raised_err ->
                  update_failed_delivery(acc_state, delivery.subscriber_id, delivery.sequence, raised_err)

                other ->
                  update_failed_delivery(acc_state, delivery.subscriber_id, delivery.sequence, {:error, other})
              end
            else
              acc_state
            end
          else
            acc_state
          end
        else
          acc_state
        end
      end)

    {:reply, :ok, new_state}
  end

  @impl true
  def handle_call(:dead_letters, _from, state) do
    sorted_dead =
      state.dead_letters
      |> Map.values()
      |> Enum.sort_by(fn dl ->
        sub_idx = Map.get(state.subscriber_indices, dl.subscriber_id, 999999)
        {dl.sequence, sub_idx}
      end)

    {:reply, sorted_dead, state}
  end

  @impl true
  def handle_call(:reset, _from, _state) do
    # Read all events and destroy them
    events = Ash.read!(Event)
    Enum.each(events, fn event ->
      Ash.destroy!(event)
    end)

    new_state = %__MODULE__{}
    {:reply, :ok, new_state}
  end

  @impl true
  def handle_call({:register_event, notification}, _from, state) do
    # 1. Extract metadata & attributes
    resource = notification.resource
    aggregate_type = get_aggregate_type(resource)
    aggregate_id = Map.get(notification.data, :id) |> to_string()
    action = notification.action.name
    actor_id = get_actor_id(notification.actor)

    changes = compute_changes(notification)

    # 2. Increment counters
    new_global_seq = state.global_sequence + 1
    agg_key = {aggregate_type, aggregate_id}
    new_agg_seq = Map.get(state.aggregate_sequences, agg_key, 0) + 1

    dedup_key = "#{aggregate_type}:#{aggregate_id}:#{action}:#{new_agg_seq}"

    # 3. Create Event record in ETS
    event = Ash.create!(Event, %{
      sequence: new_global_seq,
      aggregate_sequence: new_agg_seq,
      topic: "ledger.#{aggregate_type}.#{action}",
      resource: inspect(resource),
      aggregate_type: aggregate_type,
      aggregate_id: aggregate_id,
      action: action,
      actor_id: actor_id,
      changes: changes,
      dedup_key: dedup_key
    })

    # 4. Find matching subscribers
    topic = "ledger.#{aggregate_type}.#{action}"

    matching_subs =
      state.subscribers
      |> Enum.filter(fn sub ->
        new_global_seq > sub.subscribed_at_sequence and match_pattern?(sub.pattern, topic)
      end)

    # 5. Add pending deliveries and separate sync subscribers to be executed by caller
    {new_pending, sync_subs} =
      Enum.reduce(matching_subs, {state.pending_deliveries, []}, fn sub, {pending_acc, sync_acc} ->
        delivery = %{
          subscriber_id: sub.id,
          sequence: new_global_seq,
          attempts: 0
        }

        new_pending_acc = Map.put(pending_acc, {sub.id, new_global_seq}, delivery)

        if sub.mode == :sync do
          {new_pending_acc, sync_acc ++ [sub]}
        else
          {new_pending_acc, sync_acc}
        end
      end)

    new_state = %{state |
      global_sequence: new_global_seq,
      aggregate_sequences: Map.put(state.aggregate_sequences, agg_key, new_agg_seq),
      pending_deliveries: new_pending
    }

    {:reply, {:ok, event, sync_subs}, new_state}
  end

  @impl true
  def handle_call({:acknowledge_delivery, subscriber_id, sequence}, _from, state) do
    new_pending = Map.delete(state.pending_deliveries, {subscriber_id, sequence})
    {:reply, :ok, %{state | pending_deliveries: new_pending}}
  end

  @impl true
  def handle_call({:fail_delivery, subscriber_id, sequence, reason}, _from, state) do
    new_state = update_failed_delivery(state, subscriber_id, sequence, reason)
    {:reply, :ok, new_state}
  end

  @impl true
  def handle_call({:get_subscriber, subscriber_id}, _from, state) do
    subscriber = Enum.find(state.subscribers, &(&1.id == subscriber_id))
    {:reply, subscriber, state}
  end

  # --- Helper Functions ---

  defp get_aggregate_type(resource) do
    resource
    |> Module.split()
    |> List.last()
    |> Macro.underscore()
  end

  defp get_actor_id(nil), do: nil
  defp get_actor_id(actor) when is_map(actor) do
    case Map.get(actor, :id) do
      val when is_binary(val) -> val
      _ -> nil
    end
  end
  defp get_actor_id(_), do: nil

  defp compute_changes(%{changeset: %{action_type: :create}} = notification) do
    resource = notification.resource
    public_non_pk_attributes =
      resource
      |> Ash.Resource.Info.public_attributes()
      |> Enum.reject(& &1.primary_key?)

    Enum.reduce(public_non_pk_attributes, %{}, fn attr, acc ->
      val = Map.get(notification.data, attr.name)
      if val != nil do
        Map.put(acc, Atom.to_string(attr.name), %{"from" => nil, "to" => encode_val(val)})
      else
        acc
      end
    end)
  end

  defp compute_changes(%{changeset: %{action_type: :destroy}}) do
    %{}
  end

  defp compute_changes(%{changeset: %{action_type: :update}} = notification) do
    resource = notification.resource
    public_non_pk_attributes =
      resource
      |> Ash.Resource.Info.public_attributes()
      |> Enum.reject(& &1.primary_key?)

    changeset = notification.changeset

    is_batch? =
      changeset.context[:bulk?] == true or
      changeset.context[:private][:bulk?] == true or
      is_nil(changeset.data) or
      Enum.any?(public_non_pk_attributes, fn attr ->
        match?(%Ash.NotLoaded{}, Map.get(changeset.data, attr.name))
      end)

    if is_batch? do
      Enum.reduce(public_non_pk_attributes, %{}, fn attr, acc ->
        if Map.has_key?(changeset.attributes, attr.name) do
          after_val = Map.get(notification.data, attr.name)
          Map.put(acc, Atom.to_string(attr.name), %{"from" => nil, "to" => encode_val(after_val)})
        else
          acc
        end
      end)
    else
      Enum.reduce(public_non_pk_attributes, %{}, fn attr, acc ->
        before_val = Map.get(changeset.data, attr.name)
        after_val = Map.get(notification.data, attr.name)

        before_val = if match?(%Ash.NotLoaded{}, before_val), do: nil, else: before_val

        if before_val != after_val do
          Map.put(acc, Atom.to_string(attr.name), %{
            "from" => encode_val(before_val),
            "to" => encode_val(after_val)
          })
        else
          acc
        end
      end)
    end
  end

  defp compute_changes(_notification) do
    %{}
  end

  defp encode_val(nil), do: nil
  defp encode_val(val) when is_atom(val), do: Atom.to_string(val)
  defp encode_val(val), do: val

  defp update_failed_delivery(state, subscriber_id, sequence, reason) do
    key = {subscriber_id, sequence}

    case Map.get(state.pending_deliveries, key) do
      nil ->
        state

      delivery ->
        new_attempts = delivery.attempts + 1

        if new_attempts >= 3 do
          dead_letter = %{
            subscriber_id: subscriber_id,
            sequence: sequence,
            attempts: new_attempts,
            reason: reason
          }

          new_pending = Map.delete(state.pending_deliveries, key)
          new_dead = Map.put(state.dead_letters, key, dead_letter)
          %{state | pending_deliveries: new_pending, dead_letters: new_dead}
        else
          new_delivery = %{delivery | attempts: new_attempts}
          new_pending = Map.put(state.pending_deliveries, key, new_delivery)
          %{state | pending_deliveries: new_pending}
        end
    end
  end

  # --- Pattern Matching Logic ---

  def match_pattern?(pattern_string, topic_string) do
    pattern_segments = String.split(pattern_string, ".")
    topic_segments = String.split(topic_string, ".")
    match_segments?(pattern_segments, topic_segments)
  end

  defp match_segments?([], []), do: true
  defp match_segments?(["#"], _topic), do: true
  defp match_segments?([], _topic), do: false
  defp match_segments?(_pattern, []), do: false

  defp match_segments?(["*" | pat_tail], [_top_head | top_tail]) do
    match_segments?(pat_tail, top_tail)
  end

  defp match_segments?([head | pat_tail], [head | top_tail]) do
    match_segments?(pat_tail, top_tail)
  end

  defp match_segments?(_pattern, _topic), do: false
end
