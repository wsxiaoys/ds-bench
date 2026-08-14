defmodule ThreadGraph.Forum.Messages.LinkedMessages do
  @moduledoc """
  Implements the manual relationship `linked_messages` on Message.
  """
  use Ash.Resource.ManualRelationship

  @impl true
  def load(records, _opts, context) do
    ThreadGraph.Forum.LoadCounter.bump(:linked_messages)

    # Fetch all message links and messages
    clean_links_query = ThreadGraph.Forum.MessageLink |> Ash.Query.new()
    clean_msg_query = ThreadGraph.Forum.Message |> Ash.Query.new()

    message_links = Ash.read!(clean_links_query, Ash.Context.to_opts(context))
    all_messages = Ash.read!(clean_msg_query, Ash.Context.to_opts(context))

    messages_map = Map.new(all_messages, & {&1.id, &1})
    adjacency_map = Enum.group_by(message_links, & &1.from_message_id, & &1.to_message_id)

    results =
      Enum.map(records, fn msg ->
        reachable_map = bfs(msg.id, adjacency_map)

        reachable_map
        |> Enum.filter(fn {id, _dist} -> Map.has_key?(messages_map, id) end)
        |> Enum.map(fn {id, dist} ->
          msg_rec = Map.fetch!(messages_map, id)
          msg_with_meta =
            msg_rec
            |> Ash.Resource.put_metadata(:hop_distance, dist)
            |> Ash.Resource.put_metadata(:distance, dist)
            |> Ash.Resource.put_metadata(:minimum_hop_distance, dist)

          {msg_with_meta, dist}
        end)
        |> Enum.sort_by(fn {msg_rec, dist} -> {dist, msg_rec.position, msg_rec.id} end, fn {dist1, pos1, id1}, {dist2, pos2, id2} ->
          cond do
            dist1 < dist2 -> true
            dist1 > dist2 -> false
            pos1 < pos2 -> true
            pos1 > pos2 -> false
            true -> id1 < id2
          end
        end)
        |> Enum.map(fn {msg_rec, _dist} -> msg_rec end)
      end)

    {:ok, results}
  end

  defp bfs(source_id, adjacency_map) do
    initial_neighbors = Map.get(adjacency_map, source_id, [])
    queue = :queue.from_list(Enum.map(initial_neighbors, & {&1, 1}))
    visited = Map.new(initial_neighbors, & {&1, 1})

    do_bfs(queue, visited, adjacency_map)
    |> Map.delete(source_id)
  end

  defp do_bfs(queue, visited, adjacency_map) do
    case :queue.out(queue) do
      {{:value, {node_id, dist}}, queue} ->
        neighbors = Map.get(adjacency_map, node_id, [])
        {new_queue, new_visited} =
          Enum.reduce(neighbors, {queue, visited}, fn next_id, {q, vis} ->
            if Map.has_key?(vis, next_id) do
              {q, vis}
            else
              {:queue.in({next_id, dist + 1}, q), Map.put(vis, next_id, dist + 1)}
            end
          end)
        do_bfs(new_queue, new_visited, adjacency_map)

      {:empty, _queue} ->
        visited
    end
  end
end
