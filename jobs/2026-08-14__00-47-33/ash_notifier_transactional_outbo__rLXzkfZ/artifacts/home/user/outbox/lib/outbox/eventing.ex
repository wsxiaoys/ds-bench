defmodule Outbox.Eventing do
  @moduledoc """
  The eventing domain.
  """

  use Ash.Domain, otp_app: :outbox
  require Ash.Query

  resources do
    resource Outbox.Eventing.Event
  end

  def list_events!() do
    Outbox.Eventing.Event
    |> Ash.Query.sort(sequence: :asc)
    |> Ash.read!()
  end

  def events_for!(aggregate_type, aggregate_id) do
    Outbox.Eventing.Event
    |> Ash.Query.filter(aggregate_type == ^aggregate_type and aggregate_id == ^aggregate_id)
    |> Ash.Query.sort(aggregate_sequence: :asc)
    |> Ash.read!()
  end

  def replay(after_sequence, subscriber_id) do
    case GenServer.call(Outbox.Eventing.Dispatcher, {:get_subscriber, subscriber_id}) do
      nil ->
        {:ok, []}

      subscriber ->
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
          Enum.map(matching_events, fn event ->
            subscriber.handler.(event)
            event.sequence
          end)

        {:ok, delivered_sequences}
    end
  end

  # Helper pattern matcher
  def match_topic?(pattern, topic) do
    pattern_segments = String.split(pattern, ".")
    topic_segments = String.split(topic, ".")
    match_segments?(pattern_segments, topic_segments)
  end

  defp match_segments?([], []), do: true
  defp match_segments?(["#"], _), do: true
  defp match_segments?([_ | _], []), do: false
  defp match_segments?([], [_ | _]), do: false
  defp match_segments?([seg | pat_tail], [seg | top_tail]), do: match_segments?(pat_tail, top_tail)
  defp match_segments?(["*" | pat_tail], [_ | top_tail]), do: match_segments?(pat_tail, top_tail)
  defp match_segments?(_, _), do: false
end
