defmodule Outbox.Eventing.Notifier do
  @moduledoc """
  The outbox notifier that hooks into Ash post-commit notifications.
  """

  use Ash.Notifier

  @impl true
  def notify(%Ash.Notifier.Notification{} = notification) do
    action_type = notification.action.type

    resource = inspect(notification.resource)
    aggregate_type =
      notification.resource
      |> Module.split()
      |> List.last()
      |> Macro.underscore()

    aggregate_id = to_string(notification.data.id)
    action = notification.action.name

    actor_id =
      case notification.actor do
        %{id: id} when is_binary(id) -> id
        _ -> nil
      end

    topic = "ledger.#{aggregate_type}.#{action}"
    changes = calculate_changes(action_type, notification)

    # Assign sequences via Dispatcher GenServer
    {:ok, sequence, aggregate_sequence} =
      GenServer.call(Outbox.Eventing.Dispatcher, {:assign_sequences, aggregate_type, aggregate_id})

    attrs = %{
      sequence: sequence,
      aggregate_sequence: aggregate_sequence,
      topic: topic,
      resource: resource,
      aggregate_type: aggregate_type,
      aggregate_id: aggregate_id,
      action: action,
      actor_id: actor_id,
      changes: changes,
      dedup_key: "#{aggregate_type}:#{aggregate_id}:#{action}:#{aggregate_sequence}"
    }

    case Ash.create(Outbox.Eventing.Event, attrs) do
      {:ok, event} ->
        dispatch_event(event)
        :ok

      {:error, error} ->
        raise "Failed to create outbox event: #{inspect(error)}"
    end
  end

  # Helper to calculate changes
  defp calculate_changes(:destroy, _notification), do: %{}

  defp calculate_changes(:create, notification) do
    attrs = public_non_pk_attributes(notification.resource)
    Enum.reduce(attrs, %{}, fn attr_name, acc ->
      val = Map.get(notification.data, attr_name)
      if val != nil do
        Map.put(acc, Atom.to_string(attr_name), %{"from" => nil, "to" => encode_value(val)})
      else
        acc
      end
    end)
  end

  defp calculate_changes(:update, notification) do
    is_bulk? = Map.has_key?(notification.changeset.context, :bulk_update)
    attrs = public_non_pk_attributes(notification.resource)

    if is_bulk? do
      Enum.reduce(attrs, %{}, fn attr_name, acc ->
        if Map.has_key?(notification.changeset.attributes, attr_name) do
          to_val = Map.get(notification.data, attr_name)
          Map.put(acc, Atom.to_string(attr_name), %{"from" => nil, "to" => encode_value(to_val)})
        else
          acc
        end
      end)
    else
      Enum.reduce(attrs, %{}, fn attr_name, acc ->
        from_val = Map.get(notification.changeset.data, attr_name)
        to_val = Map.get(notification.data, attr_name)
        if from_val != to_val do
          Map.put(acc, Atom.to_string(attr_name), %{"from" => encode_value(from_val), "to" => encode_value(to_val)})
        else
          acc
        end
      end)
    end
  end

  defp public_non_pk_attributes(resource) do
    resource
    |> Ash.Resource.Info.public_attributes()
    |> Enum.reject(& &1.primary_key?)
    |> Enum.map(& &1.name)
  end

  defp encode_value(nil), do: nil
  defp encode_value(val) when is_atom(val), do: Atom.to_string(val)
  defp encode_value(val), do: val

  # Helper to dispatch event to subscribers
  defp dispatch_event(event) do
    subscribers = GenServer.call(Outbox.Eventing.Dispatcher, {:get_matching_subscribers, event.topic, event.sequence})

    for sub <- subscribers do
      if sub.mode == :sync do
        try do
          case sub.handler.(event) do
            :ok ->
              GenServer.call(Outbox.Eventing.Dispatcher, {:record_sync_delivery, event.sequence, sub.id, :ok})
            {:error, reason} ->
              GenServer.call(Outbox.Eventing.Dispatcher, {:record_sync_delivery, event.sequence, sub.id, {:error, reason}})
          end
        rescue
          e ->
            GenServer.call(Outbox.Eventing.Dispatcher, {:record_sync_delivery, event.sequence, sub.id, {:raised, e}})
        end
      else
        GenServer.call(Outbox.Eventing.Dispatcher, {:record_async_delivery, event.sequence, sub.id})
      end
    end
  end
end
