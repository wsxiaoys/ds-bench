defmodule ThreadGraph.Forum.Messages.AncestorMessages do
  use Ash.Resource.ManualRelationship

  @impl true
  def load(records, _opts, context) do
    ThreadGraph.Forum.LoadCounter.bump(:ancestor_messages)

    opts = [
      domain: context.domain,
      actor: context.actor,
      tenant: context.tenant,
      tracer: context.tracer,
      authorize?: context.authorize?
    ]

    case Ash.read(ThreadGraph.Forum.Message, opts) do
      {:ok, all_messages} ->
        message_map = Map.new(all_messages, &{&1.id, &1})

        result_map =
          Map.new(records, fn record ->
            ancestors = get_ancestors(record, message_map)
            {record.id, ancestors}
          end)

        {:ok, result_map}

      {:error, error} ->
        {:error, error}
    end
  end

  defp get_ancestors(msg, message_map) do
    traverse(msg.parent_id, message_map, [msg.id], [])
  end

  defp traverse(nil, _map, _visited, acc), do: acc
  defp traverse(parent_id, map, visited, acc) do
    if parent_id in visited do
      acc
    else
      case Map.get(map, parent_id) do
        nil -> acc
        parent -> traverse(parent.parent_id, map, [parent_id | visited], [parent | acc])
      end
    end
  end
end
