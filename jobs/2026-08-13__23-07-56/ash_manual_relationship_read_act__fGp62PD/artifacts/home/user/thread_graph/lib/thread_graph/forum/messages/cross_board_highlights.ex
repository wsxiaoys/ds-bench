defmodule ThreadGraph.Forum.Messages.CrossBoardHighlights do
  use Ash.Resource.ManualRead

  @impl true
  def read(query, _data_layer_query, opts, _context) do
    ThreadGraph.Forum.LoadCounter.bump(:cross_board_highlights)

    boards = Ash.Query.get_argument(query, :boards)
    min_endorsements = Ash.Query.get_argument(query, :min_endorsements) || 0

    # Read all threads, messages, and message links
    with {:ok, threads} <- Ash.read(ThreadGraph.Forum.Thread, opts),
         {:ok, all_messages} <- Ash.read(ThreadGraph.Forum.Message, opts),
         {:ok, links} <- Ash.read(ThreadGraph.Forum.MessageLink, opts) do
      thread_boards = Map.new(threads, &{&1.id, &1.board})

      follow_ups = Enum.filter(links, & &1.kind == :follow_up)
      endorsement_counts =
        Enum.reduce(follow_ups, %{}, fn link, acc ->
          Map.update(acc, link.to_message_id, 1, &(&1 + 1))
        end)

      filtered_messages =
        all_messages
        |> Enum.map(fn msg ->
          count = Map.get(endorsement_counts, msg.id, 0)
          Ash.Resource.put_metadata(msg, :endorsement_count, count)
        end)
        |> Enum.filter(fn msg ->
          board = Map.get(thread_boards, msg.thread_id)
          count = Ash.Resource.get_metadata(msg, :endorsement_count)
          board in boards and count >= min_endorsements
        end)

      case Ash.Filter.Runtime.filter_matches(query.domain, filtered_messages, query.filter) do
        {:ok, matched_messages} ->
          sorted_messages =
            if query.sort in [nil, []] do
              Enum.sort_by(matched_messages, fn msg ->
                count = Ash.Resource.get_metadata(msg, :endorsement_count)
                {count, msg.position, msg.id}
              end, fn {count1, pos1, id1}, {count2, pos2, id2} ->
                cond do
                  count1 > count2 -> true
                  count1 < count2 -> false
                  pos1 < pos2 -> true
                  pos1 > pos2 -> false
                  true -> id1 < id2
                end
              end)
            else
              Ash.Sort.runtime_sort(matched_messages, query.sort, domain: query.domain)
            end

          offset = query.offset || 0
          limit = query.limit

          paginated_messages =
            sorted_messages
            |> Enum.drop(offset)
            |> then(fn list ->
              if limit do
                Enum.take(list, limit)
              else
                list
              end
            end)

          {:ok, paginated_messages}

        {:error, error} ->
          {:error, error}
      end
    else
      {:error, error} -> {:error, error}
    end
  end
end
