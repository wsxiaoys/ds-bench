defmodule Outbox.Eventing.Notifier do
  @moduledoc """
  A notifier that captures post-commit resource notifications and appends outbox entries.
  """

  use Ash.Notifier

  alias Outbox.Eventing.SequenceServer
  alias Outbox.Eventing.Dispatcher

  @impl true
  def notify(%Ash.Notifier.Notification{} = notification) do
    resource = notification.resource

    action_name =
      case notification.action do
        %{name: name} -> name
        name when is_atom(name) -> name
      end

    agg_type =
      resource
      |> Module.split()
      |> List.last()
      |> Macro.underscore()

    topic = "ledger.#{agg_type}.#{action_name}"
    agg_id = to_string(notification.data.id)

    actor_id =
      case notification.actor do
        actor when is_map(actor) or is_struct(actor) ->
          case Map.get(actor, :id) do
            id when is_binary(id) -> id
            _ -> nil
          end

        _ ->
          nil
      end

    resource_str = inspect(resource)
    changes = compute_changes(notification)

    attrs = %{
      topic: topic,
      resource: resource_str,
      aggregate_type: agg_type,
      aggregate_id: agg_id,
      action: action_name,
      actor_id: actor_id,
      changes: changes
    }

    case SequenceServer.create_event(attrs) do
      {:ok, event} ->
        {:ok, sync_subs} = Dispatcher.register_event(event)

        for sub <- sync_subs do
          result =
            try do
              case sub.handler.(event) do
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
              Dispatcher.acknowledge_delivery(sub.id, event.sequence)

            reason ->
              Dispatcher.fail_delivery(sub.id, event.sequence, reason)
          end
        end

        :ok

      {:error, _error} ->
        :ok
    end
  end

  defp compute_changes(notification) do
    resource = notification.resource
    changeset = notification.changeset

    action_type =
      case notification.action do
        %{type: type} -> type
        _ -> :update
      end

    public_attributes =
      resource
      |> Ash.Resource.Info.attributes()
      |> Enum.filter(fn attr -> attr.public? and not attr.primary_key? end)

    case action_type do
      :create ->
        public_attributes
        |> Enum.reduce(%{}, fn attr, acc ->
          val = Map.get(notification.data, attr.name)

          if val != nil do
            Map.put(acc, Atom.to_string(attr.name), %{"from" => nil, "to" => encode_value(val)})
          else
            acc
          end
        end)

      :update ->
        is_single_update =
          match?(%_struct{}, changeset.data) and
            Map.get(changeset.data, :id) == Map.get(notification.data, :id)

        if is_single_update do
          public_attributes
          |> Enum.reduce(%{}, fn attr, acc ->
            before_val = Map.get(changeset.data, attr.name)
            after_val = Map.get(notification.data, attr.name)

            if before_val != after_val do
              Map.put(acc, Atom.to_string(attr.name), %{
                "from" => encode_value(before_val),
                "to" => encode_value(after_val)
              })
            else
              acc
            end
          end)
        else
          public_attributes
          |> Enum.reduce(%{}, fn attr, acc ->
            if Map.has_key?(changeset.attributes, attr.name) do
              after_val = Map.get(notification.data, attr.name)

              Map.put(acc, Atom.to_string(attr.name), %{
                "from" => nil,
                "to" => encode_value(after_val)
              })
            else
              acc
            end
          end)
        end

      :destroy ->
        %{}

      _ ->
        %{}
    end
  end

  defp encode_value(nil), do: nil
  defp encode_value(value) when is_atom(value), do: Atom.to_string(value)
  defp encode_value(value), do: value
end
