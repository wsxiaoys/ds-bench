defmodule Outbox.Eventing.Notifier do
  @moduledoc """
  Notifier that hooks into ledger resource commit notifications.
  """

  use Ash.Notifier

  @impl true
  def notify(%Ash.Notifier.Notification{} = notification) do
    case Outbox.Eventing.Dispatcher.register_event(notification) do
      {:ok, event, sync_subscribers} ->
        for sub <- sync_subscribers do
          try do
            case sub.handler.(event) do
              :ok ->
                Outbox.Eventing.Dispatcher.acknowledge_delivery(sub.id, event.sequence)

              {:error, reason} ->
                Outbox.Eventing.Dispatcher.fail_delivery(sub.id, event.sequence, reason)
            end
          rescue
            e ->
              Outbox.Eventing.Dispatcher.fail_delivery(sub.id, event.sequence, {:raised, Exception.message(e)})
          catch
            kind, value ->
              Outbox.Eventing.Dispatcher.fail_delivery(sub.id, event.sequence, {:raised, "caught #{inspect(kind)}: #{inspect(value)}"})
          end
        end
        :ok

      _ ->
        :ok
    end
  end
end
