defmodule Outbox.Eventing.Dispatcher do
  @moduledoc """
  A supervised, long-lived process that fanns entries out to subscribers.
  """

  use GenServer

  alias Outbox.Eventing.Event

  require Ash.Query

  # Client API

  def start_link(opts) do
    GenServer.start_link(__MODULE__, :ok, Keyword.put_new(opts, :name, __MODULE__))
  end

  @spec subscribe(
          subscriber_id :: atom(),
          pattern :: String.t(),
          handler :: (Event.t() -> :ok | {:error, term()}),
          opts :: keyword()
        ) :: :ok | {:error, :already_subscribed}
  def subscribe(subscriber_id, pattern, handler, opts \\ []) do
    mode = Keyword.get(opts, :mode, :async)
    GenServer.call(__MODULE__, {:subscribe, subscriber_id, pattern, handler, mode})
  end

  @spec unsubscribe(subscriber_id :: atom()) :: :ok
  def unsubscribe(subscriber_id) do
    GenServer.call(__MODULE__, {:unsubscribe, subscriber_id})
  end

  @spec flush() :: :ok
  def flush() do
    GenServer.call(__MODULE__, :flush)
  end

  @spec dead_letters() :: [map()]
  def dead_letters() do
    GenServer.call(__MODULE__, :dead_letters)
  end

  @spec reset() :: :ok
  def reset() do
    GenServer.call(__MODULE__, :reset)
  end

  @spec replay(after_sequence :: integer(), subscriber_id :: atom()) :: {:ok, [integer()]}
  def replay(after_sequence, subscriber_id) do
    case GenServer.call(__MODULE__, {:get_subscriber, subscriber_id}) do
      nil ->
        {:ok, []}

      subscriber ->
        do_replay(after_sequence, subscriber)
    end
  end

  # Internal helpers for notifier

  def register_event(event) do
    GenServer.call(__MODULE__, {:register_event, event})
  end

  def acknowledge_delivery(subscriber_id, sequence) do
    GenServer.call(__MODULE__, {:acknowledge_delivery, subscriber_id, sequence})
  end

  def fail_delivery(subscriber_id, sequence, reason) do
    GenServer.call(__MODULE__, {:fail_delivery, subscriber_id, sequence, reason})
  end

  # Server Callbacks

  @impl true
  def init(:ok) do
    {:ok,
     %{
       subscribers: [],
       pending_deliveries: [],
       dead_letters: []
     }}
  end

  @impl true
  def handle_call({:subscribe, subscriber_id, pattern, handler, mode}, _from, state) do
    if Enum.any?(state.subscribers, &(&1.id == subscriber_id)) do
      {:reply, {:error, :already_subscribed}, state}
    else
      current_seq = Outbox.Eventing.SequenceServer.get_current_sequence()

      subscriber = %{
        id: subscriber_id,
        pattern: pattern,
        handler: handler,
        mode: mode,
        subscribed_at_sequence: current_seq
      }

      new_state = %{state | subscribers: state.subscribers ++ [subscriber]}
      {:reply, :ok, new_state}
    end
  end

  def handle_call({:unsubscribe, subscriber_id}, _from, state) do
    new_subscribers = Enum.reject(state.subscribers, &(&1.id == subscriber_id))
    new_pending = Enum.reject(state.pending_deliveries, &(&1.subscriber_id == subscriber_id))

    new_state = %{
      state
      | subscribers: new_subscribers,
        pending_deliveries: new_pending
    }

    {:reply, :ok, new_state}
  end

  def handle_call(:flush, _from, state) do
    snapshot = state.pending_deliveries
    sorted_snapshot = sort_deliveries(snapshot, state.subscribers)

    new_state =
      Enum.reduce(sorted_snapshot, state, fn delivery, acc_state ->
        subscriber = Enum.find(acc_state.subscribers, &(&1.id == delivery.subscriber_id))

        if subscriber == nil do
          %{acc_state | pending_deliveries: remove_pending(acc_state.pending_deliveries, delivery)}
        else
          event = fetch_event(delivery.sequence)

          result =
            try do
              case subscriber.handler.(event) do
                :ok -> :ok
                {:error, reason} -> {:error, reason}
                other -> {:error, other}
              end
            rescue
              e ->
                {:raised, e}
            catch
              kind, value ->
                {:raised, {kind, value}}
            end

          case result do
            :ok ->
              %{acc_state | pending_deliveries: remove_pending(acc_state.pending_deliveries, delivery)}

            reason ->
              new_attempts = delivery.attempts + 1

              if new_attempts >= 3 do
                dead_letter = %{
                  subscriber_id: delivery.subscriber_id,
                  sequence: delivery.sequence,
                  attempts: new_attempts,
                  reason: format_reason(reason)
                }

                %{
                  acc_state
                  | pending_deliveries: remove_pending(acc_state.pending_deliveries, delivery),
                    dead_letters: acc_state.dead_letters ++ [dead_letter]
                }
              else
                updated_pending =
                  Enum.map(acc_state.pending_deliveries, fn p ->
                    if p.subscriber_id == delivery.subscriber_id and p.sequence == delivery.sequence do
                      %{p | attempts: new_attempts, last_reason: reason}
                    else
                      p
                    end
                  end)

                %{acc_state | pending_deliveries: updated_pending}
              end
          end
        end
      end)

    {:reply, :ok, new_state}
  end

  def handle_call(:dead_letters, _from, state) do
    sorted = sort_deliveries(state.dead_letters, state.subscribers)
    {:reply, sorted, state}
  end

  def handle_call(:reset, _from, _state) do
    :ok = Outbox.Eventing.SequenceServer.reset()

    new_state = %{
      subscribers: [],
      pending_deliveries: [],
      dead_letters: []
    }

    {:reply, :ok, new_state}
  end

  def handle_call({:get_subscriber, subscriber_id}, _from, state) do
    sub = Enum.find(state.subscribers, &(&1.id == subscriber_id))
    {:reply, sub, state}
  end

  def handle_call({:register_event, event}, _from, state) do
    matching_subs =
      Enum.filter(state.subscribers, fn sub ->
        event.sequence > sub.subscribed_at_sequence and match_topic?(sub.pattern, event.topic)
      end)

    new_deliveries =
      Enum.map(matching_subs, fn sub ->
        %{
          subscriber_id: sub.id,
          sequence: event.sequence,
          attempts: 0,
          last_reason: nil
        }
      end)

    new_state = %{state | pending_deliveries: state.pending_deliveries ++ new_deliveries}
    sync_subs = Enum.filter(matching_subs, &(&1.mode == :sync))

    {:reply, {:ok, sync_subs}, new_state}
  end

  def handle_call({:acknowledge_delivery, subscriber_id, sequence}, _from, state) do
    new_pending =
      Enum.reject(state.pending_deliveries, fn p ->
        p.subscriber_id == subscriber_id and p.sequence == sequence
      end)

    {:reply, :ok, %{state | pending_deliveries: new_pending}}
  end

  def handle_call({:fail_delivery, subscriber_id, sequence, reason}, _from, state) do
    delivery =
      Enum.find(state.pending_deliveries, fn p ->
        p.subscriber_id == subscriber_id and p.sequence == sequence
      end)

    new_state =
      if delivery do
        new_attempts = delivery.attempts + 1

        if new_attempts >= 3 do
          dead_letter = %{
            subscriber_id: subscriber_id,
            sequence: sequence,
            attempts: new_attempts,
            reason: format_reason(reason)
          }

          %{
            state
            | pending_deliveries: remove_pending(state.pending_deliveries, delivery),
              dead_letters: state.dead_letters ++ [dead_letter]
          }
        else
          updated_pending =
            Enum.map(state.pending_deliveries, fn p ->
              if p.subscriber_id == subscriber_id and p.sequence == sequence do
                %{p | attempts: new_attempts, last_reason: reason}
              else
                p
              end
            end)

          %{state | pending_deliveries: updated_pending}
        end
      else
        state
      end

    {:reply, :ok, new_state}
  end

  # Private Helpers

  defp sort_deliveries(deliveries, subscribers) do
    sub_ids = Enum.map(subscribers, & &1.id)

    Enum.sort_by(deliveries, fn delivery ->
      sub_index = Enum.find_index(sub_ids, &(&1 == delivery.subscriber_id)) || 999_999
      {delivery.sequence, sub_index}
    end)
  end

  defp remove_pending(pending_list, delivery) do
    Enum.reject(pending_list, fn p ->
      p.subscriber_id == delivery.subscriber_id and p.sequence == delivery.sequence
    end)
  end

  defp fetch_event(sequence) do
    Outbox.Eventing.Event
    |> Ash.Query.filter(sequence == ^sequence)
    |> Ash.read!()
    |> List.first()
  end

  defp format_reason({:error, reason}), do: reason
  defp format_reason({:raised, e}) when is_struct(e) do
    if Spark.implements_behaviour?(e.__struct__, Exception) or function_exported?(e.__struct__, :exception, 1) do
      {:raised, Exception.message(e)}
    else
      {:raised, inspect(e)}
    end
  end
  defp format_reason({:raised, other}), do: {:raised, inspect(other)}
  defp format_reason(other), do: other

  def match_topic?(pattern, topic) do
    pattern_segments = String.split(pattern, ".")
    topic_segments = String.split(topic, ".")
    match_segments?(pattern_segments, topic_segments)
  end

  defp match_segments?([], []), do: true
  defp match_segments?(["#"], _), do: true
  defp match_segments?([_ | _], []), do: false
  defp match_segments?([], [_ | _]), do: false
  defp match_segments?([head | tail_pat], [head | tail_topic]), do: match_segments?(tail_pat, tail_topic)
  defp match_segments?(["*" | tail_pat], [_ | tail_topic]), do: match_segments?(tail_pat, tail_topic)
  defp match_segments?(_, _), do: false

  defp do_replay(after_sequence, subscriber) do
    events =
      Outbox.Eventing.Event
      |> Ash.Query.filter(sequence > ^after_sequence)
      |> Ash.Query.sort(sequence: :asc)
      |> Ash.read!()

    matching_events =
      Enum.filter(events, fn event ->
        match_topic?(subscriber.pattern, event.topic)
      end)

    delivered_sequences =
      Enum.reduce(matching_events, [], fn event, acc ->
        try do
          case subscriber.handler.(event) do
            :ok ->
              acc ++ [event.sequence]

            _ ->
              acc
          end
        rescue
          _ ->
            acc
        catch
          _, _ ->
            acc
        end
      end)

    {:ok, delivered_sequences}
  end
end
