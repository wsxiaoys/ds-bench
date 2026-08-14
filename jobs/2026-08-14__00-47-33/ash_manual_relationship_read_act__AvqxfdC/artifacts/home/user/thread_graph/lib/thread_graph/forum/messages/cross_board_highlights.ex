defmodule ThreadGraph.Forum.Messages.CrossBoardHighlights do
  @moduledoc """
  Implements the manual read action `cross_board_highlights` on Message.
  """
  use Ash.Resource.ManualRead

  @impl true
  def read(ash_query, _data_layer_query, _opts, _context) do
    ThreadGraph.Forum.LoadCounter.bump(:cross_board_highlights)

    boards = Map.fetch!(ash_query.arguments, :boards)
    min_endorsements = Map.get(ash_query.arguments, :min_endorsements, 0) || 0

    # Fetch threads, message links, and messages
    threads = Ash.read!(ThreadGraph.Forum.Thread, Ash.Context.to_opts(ash_query.context))
    message_links = Ash.read!(ThreadGraph.Forum.MessageLink, Ash.Context.to_opts(ash_query.context))
    messages = Ash.read!(ThreadGraph.Forum.Message, Ash.Context.to_opts(ash_query.context))

    endorsements_by_message =
      message_links
      |> Enum.filter(& &1.kind == :follow_up)
      |> Enum.group_by(& &1.to_message_id)
      |> Map.new(fn {msg_id, links} -> {msg_id, Enum.count(links)} end)

    threads_map = Map.new(threads, & {&1.id, &1})
    boards_set = MapSet.new(boards)

    filtered_messages =
      messages
      |> Enum.filter(fn msg ->
        thread = Map.get(threads_map, msg.thread_id)
        endorsement_count = Map.get(endorsements_by_message, msg.id, 0)

        thread && MapSet.member?(boards_set, thread.board) && endorsement_count >= min_endorsements
      end)
      |> Enum.map(fn msg ->
        endorsement_count = Map.get(endorsements_by_message, msg.id, 0)
        Ash.Resource.put_metadata(msg, :endorsement_count, endorsement_count)
      end)

    # Honour filter carried by the incoming query
    case Ash.Filter.Runtime.filter_matches(ash_query.domain, filtered_messages, ash_query.filter,
           tenant: ash_query.tenant,
           actor: ash_query.context[:private][:actor]
         ) do
      {:ok, matched_messages} ->
        # Honour sorting
        sorted_messages =
          if ash_query.sort && ash_query.sort != [] do
            Ash.Actions.Sort.runtime_sort(matched_messages, ash_query.sort, domain: ash_query.domain)
          else
            Enum.sort_by(matched_messages, fn msg ->
              endorsement_count = Ash.Resource.get_metadata(msg, :endorsement_count) || 0
              {endorsement_count, msg.position, msg.id}
            end, fn {ec1, pos1, id1}, {ec2, pos2, id2} ->
              cond do
                ec1 > ec2 -> true
                ec1 < ec2 -> false
                pos1 < pos2 -> true
                pos1 > pos2 -> false
                true -> id1 < id2
              end
            end)
          end

        # Honour limit and offset
        offset = ash_query.offset || 0
        limit = ash_query.limit

        final_messages =
          sorted_messages
          |> Enum.drop(offset)
          |> then(fn list ->
            if limit do
              Enum.take(list, limit)
            else
              list
            end
          end)

        {:ok, final_messages}

      {:error, error} ->
        {:error, error}
    end
  end
end
