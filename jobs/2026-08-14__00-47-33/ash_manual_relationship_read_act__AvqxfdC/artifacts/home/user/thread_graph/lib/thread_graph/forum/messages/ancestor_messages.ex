defmodule ThreadGraph.Forum.Messages.AncestorMessages do
  @moduledoc """
  Implements the manual relationship `ancestor_messages` on Message.
  """
  use Ash.Resource.ManualRelationship

  @impl true
  def load(records, _opts, context) do
    ThreadGraph.Forum.LoadCounter.bump(:ancestor_messages)

    # Fetch all messages in the database using a single read action
    clean_query =
      ThreadGraph.Forum.Message
      |> Ash.Query.new()

    all_messages = Ash.read!(clean_query, Ash.Context.to_opts(context))
    messages_map = Map.new(all_messages, & {&1.id, &1})

    results =
      Enum.map(records, fn msg ->
        get_ancestors(msg, messages_map)
      end)

    {:ok, results}
  end

  defp get_ancestors(msg, messages_map) do
    get_ancestors_helper(msg.parent_id, msg.id, messages_map, [], MapSet.new([msg.id]))
  end

  defp get_ancestors_helper(nil, _source_id, _messages_map, acc, _visited), do: acc
  defp get_ancestors_helper(parent_id, source_id, messages_map, acc, visited) do
    if MapSet.member?(visited, parent_id) do
      acc
    else
      case Map.fetch(messages_map, parent_id) do
        {:ok, parent_msg} ->
          get_ancestors_helper(
            parent_msg.parent_id,
            source_id,
            messages_map,
            [parent_msg | acc],
            MapSet.put(visited, parent_id)
          )
        :error ->
          acc
      end
    end
  end
end
