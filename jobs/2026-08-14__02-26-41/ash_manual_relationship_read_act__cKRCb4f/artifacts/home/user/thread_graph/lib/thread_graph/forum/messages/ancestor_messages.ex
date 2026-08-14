defmodule ThreadGraph.Forum.Messages.AncestorMessages do
  use Ash.Resource.ManualRelationship
  require Ash.Query

  @impl true
  def select(_opts), do: [:id, :parent_id]

  @impl true
  def load(records, _opts, %{query: query} = context) do
    ThreadGraph.Forum.LoadCounter.bump(:ancestor_messages)

    if records == [] do
      {:ok, []}
    else
      # Fetch all messages with the same loads/selects as requested, but without filter/sort/limit/offset
      fetch_query =
        query
        |> Ash.Query.ensure_selected([:id, :parent_id])
        |> Ash.Query.unset([:filter, :sort, :limit, :offset])

      all_messages = Ash.read!(fetch_query, Ash.Context.to_opts(context))
      messages_by_id = Map.new(all_messages, &{&1.id, &1})

      result =
        Enum.map(records, fn record ->
          ancestor_list = get_ancestors(record, messages_by_id, MapSet.new([record.id]), [])

          # Apply filter if present
          filtered_ancestors =
            if query.filter do
              case Ash.Filter.Runtime.filter_matches(context.domain, ancestor_list, query.filter) do
                {:ok, filtered} -> filtered
                _ -> ancestor_list
              end
            else
              ancestor_list
            end

          # Apply limit and offset if present
          offset = query.offset || 0
          limit = query.limit

          filtered_ancestors
          |> Enum.drop(offset)
          |> then(fn list ->
            if limit, do: Enum.take(list, limit), else: list
          end)
        end)

      {:ok, result}
    end
  end

  defp get_ancestors(msg, messages_by_id, visited, acc) do
    case msg.parent_id do
      nil -> acc
      parent_id ->
        if MapSet.member?(visited, parent_id) do
          acc
        else
          case Map.get(messages_by_id, parent_id) do
            nil -> acc
            parent ->
              get_ancestors(parent, messages_by_id, MapSet.put(visited, parent_id), [parent | acc])
          end
        end
    end
  end
end
