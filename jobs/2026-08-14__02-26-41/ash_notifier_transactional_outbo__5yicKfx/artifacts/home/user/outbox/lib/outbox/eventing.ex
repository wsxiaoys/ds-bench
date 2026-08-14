defmodule Outbox.Eventing do
  @moduledoc """
  The eventing domain.
  """

  use Ash.Domain, otp_app: :outbox
  require Ash.Query

  resources do
    resource Outbox.Eventing.Event
  end

  @doc """
  All stored entries, ascending by sequence.
  """
  def list_events! do
    Outbox.Eventing.Event
    |> Ash.Query.sort(sequence: :asc)
    |> Ash.read!()
  end

  @doc """
  Entries for one aggregate, ascending by aggregate_sequence.
  """
  def events_for!(aggregate_type, aggregate_id) do
    Outbox.Eventing.Event
    |> Ash.Query.filter(aggregate_type == ^aggregate_type and aggregate_id == ^aggregate_id)
    |> Ash.Query.sort(aggregate_sequence: :asc)
    |> Ash.read!()
  end

  @doc """
  Performs the replay and returns the delivered sequences in ascending order.
  """
  def replay(after_sequence, subscriber_id) do
    case Outbox.Eventing.Dispatcher.get_subscriber(subscriber_id) do
      nil ->
        {:ok, []}

      subscriber ->
        events =
          Outbox.Eventing.Event
          |> Ash.Query.filter(sequence > ^after_sequence)
          |> Ash.Query.sort(sequence: :asc)
          |> Ash.read!()

        delivered_sequences =
          events
          |> Enum.filter(fn event ->
            Outbox.Eventing.Dispatcher.match_pattern?(subscriber.pattern, event.topic)
          end)
          |> Enum.reduce([], fn event, acc ->
            try do
              case subscriber.handler.(event) do
                :ok -> [event.sequence | acc]
                _ -> acc
              end
            rescue
              _ -> acc
            catch
              _, _ -> acc
            end
          end)
          |> Enum.reverse()

        {:ok, delivered_sequences}
    end
  end
end
