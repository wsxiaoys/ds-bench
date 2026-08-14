defmodule ThreadGraph.Forum.Messages.LinkedMessages do
  use Ash.Resource.ManualRelationship
  require Ash.Query

  @impl true
  def select(_opts), do: [:id, :position]

  @impl true
  def load(records, _opts, %{query: query} = context) do
    ThreadGraph.Forum.LoadCounter.bump(:linked_messages)

    if records == [] do
      {:ok, []}
    else
      # Fetch all MessageLink records
      links =
        ThreadGraph.Forum.MessageLink
        |> Ash.Query.new()
        |> Ash.read!(Ash.Context.to_opts(context))

      # Build adjacency list: from_message_id => [to_message_id]
      adj =
        links
        |> Enum.group_by(& &1.from_message_id, & &1.to_message_id)

      # Fetch all messages with the same loads/selects as requested, but without filter/sort/limit/offset
      fetch_query =
        query
        |> Ash.Query.ensure_selected([:id, :position])
        |> Ash.Query.unset([:filter, :sort, :limit, :offset])

      all_messages = Ash.read!(fetch_query, Ash.Context.to_opts(context))
      messages_by_id = Map.new(all_messages, &{&1.id, &1})

      result =
        Enum.map(records, fn record ->
          # BFS to find reachable message IDs and their minimum hop distances
          visited_distances = bfs(record.id, adj)

          # Get reachable message records
          reachable_messages =
            visited_distances
            |> Map.keys()
            |> Enum.reject(&(&1 == record.id))
            |> Enum.map(&Map.get(messages_by_id, &1))
            |> Enum.reject(&is_nil/1)

          # Sort by minimum hop distance ascending, then position ascending, then id ascending
          sorted_messages =
            Enum.sort_by(reachable_messages, fn msg ->
              dist = Map.get(visited_distances, msg.id)
              {dist, msg.position, msg.id}
            end)

          # Apply filter if present
          filtered_messages =
            if query.filter do
              case Ash.Filter.Runtime.filter_matches(context.domain, sorted_messages, query.filter) do
                {:ok, filtered} -> filtered
                _ -> sorted_messages
              end
            else
              sorted_messages
            end

          # Apply limit and offset if present
          offset = query.offset || 0
          limit = query.limit

          filtered_messages
          |> Enum.drop(offset)
          |> then(fn list ->
            if limit, do: Enum.take(list, limit), else: list
          end)
        end)

      {:ok, result}
    end
  end

  defp bfs(source_id, adj) do
    q = :queue.from_list([{source_id, 0}])
    visited = %{source_id => 0}
    do_bfs(q, visited, adj)
  end

  defp do_bfs(q, visited, adj) do
    case :queue.out(q) do
      {{:value, {curr_id, dist}}, q} ->
        neighbors = Map.get(adj, curr_id, [])

        {new_q, new_visited} =
          Enum.reduce(neighbors, {q, visited}, fn nbr_id, {acc_q, acc_visited} ->
            if Map.has_key?(acc_visited, nbr_id) do
              {acc_q, acc_visited}
            else
              {
                :queue.in({nbr_id, dist + 1}, acc_q),
                Map.put(acc_visited, nbr_id, dist + 1)
              }
            end
          end)

        do_bfs(new_q, new_visited, adj)

      {:empty, _} ->
        visited
    end
  end
end
