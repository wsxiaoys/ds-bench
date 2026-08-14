defmodule ThreadGraph.Forum.Messages.LinkedMessages do
  use Ash.Resource.ManualRelationship

  @impl true
  def load(records, _opts, context) do
    ThreadGraph.Forum.LoadCounter.bump(:linked_messages)

    opts = [
      domain: context.domain,
      actor: context.actor,
      tenant: context.tenant,
      tracer: context.tracer,
      authorize?: context.authorize?
    ]

    # Batch read all message links and messages
    with {:ok, links} <- Ash.read(ThreadGraph.Forum.MessageLink, opts),
         {:ok, all_messages} <- Ash.read(ThreadGraph.Forum.Message, opts) do
      message_map = Map.new(all_messages, &{&1.id, &1})

      adjacency =
        Enum.reduce(links, %{}, fn link, acc ->
          Map.update(acc, link.from_message_id, [link.to_message_id], &[link.to_message_id | &1])
        end)

      result_map =
        Map.new(records, fn record ->
          linked = get_linked_messages(record, adjacency, message_map)
          {record.id, linked}
        end)

      {:ok, result_map}
    else
      {:error, error} -> {:error, error}
    end
  end

  defp get_linked_messages(source_msg, adjacency, message_map) do
    queue = :queue.new()
    neighbors = Map.get(adjacency, source_msg.id, [])

    queue =
      Enum.reduce(neighbors, queue, fn neighbor_id, q ->
        :queue.in({neighbor_id, 1}, q)
      end)

    visited =
      Enum.reduce(neighbors, %{}, fn neighbor_id, acc ->
        Map.put(acc, neighbor_id, 1)
      end)

    visited = bfs(queue, adjacency, visited)
    visited = Map.delete(visited, source_msg.id)

    reachable_messages =
      visited
      |> Enum.map(fn {id, dist} ->
        case Map.get(message_map, id) do
          nil ->
            nil

          msg ->
            msg
            |> Ash.Resource.put_metadata(:distance, dist)
            |> Ash.Resource.put_metadata(:hop_distance, dist)
            |> Ash.Resource.put_metadata(:minimum_hop_distance, dist)
        end
      end)
      |> Enum.reject(&is_nil/1)

    Enum.sort_by(reachable_messages, fn msg ->
      dist = Ash.Resource.get_metadata(msg, :distance)
      {dist, msg.position, msg.id}
    end, fn {dist1, pos1, id1}, {dist2, pos2, id2} ->
      cond do
        dist1 < dist2 -> true
        dist1 > dist2 -> false
        pos1 < pos2 -> true
        pos1 > pos2 -> false
        true -> id1 < id2
      end
    end)
  end

  defp bfs(queue, adjacency, visited) do
    case :queue.out(queue) do
      {{:value, {node_id, dist}}, queue} ->
        neighbors = Map.get(adjacency, node_id, [])

        {queue, visited} =
          Enum.reduce(neighbors, {queue, visited}, fn neighbor_id, {q, vis} ->
            if Map.has_key?(vis, neighbor_id) do
              {q, vis}
            else
              {:queue.in({neighbor_id, dist + 1}, q), Map.put(vis, neighbor_id, dist + 1)}
            end
          end)

        bfs(queue, adjacency, visited)

      {:empty, _queue} ->
        visited
    end
  end
end
