defmodule ThreadGraph.Forum.Messages.CrossBoardHighlights do
  use Ash.Resource.ManualRead
  require Ash.Query

  @impl true
  def read(query, _data_layer_query, _opts, context) do
    ThreadGraph.Forum.LoadCounter.bump(:cross_board_highlights)

    # Get arguments
    boards = query.arguments[:boards]
    min_endorsements = query.arguments[:min_endorsements] || 0

    # Fetch all MessageLink records
    links =
      ThreadGraph.Forum.MessageLink
      |> Ash.Query.new()
      |> Ash.read!(Ash.Context.to_opts(context))

    # Calculate endorsement count for each message
    # kind: :follow_up and to_message_id is M.id
    follow_up_links = Enum.filter(links, &(&1.kind == :follow_up))

    endorsements_by_message_id =
      follow_up_links
      |> Enum.group_by(& &1.to_message_id)
      |> Map.new(fn {msg_id, list} -> {msg_id, length(list)} end)

    # Fetch all messages with their threads loaded
    messages =
      ThreadGraph.Forum.Message
      |> Ash.Query.new()
      |> Ash.Query.load(:thread)
      |> Ash.read!(Ash.Context.to_opts(context))

    # Filter messages based on board and min_endorsements
    filtered_messages =
      Enum.filter(messages, fn msg ->
        msg.thread.board in boards and
          Map.get(endorsements_by_message_id, msg.id, 0) >= min_endorsements
      end)

    # Add metadata
    messages_with_metadata =
      Enum.map(filtered_messages, fn msg ->
        count = Map.get(endorsements_by_message_id, msg.id, 0)
        Ash.Resource.put_metadata(msg, :endorsement_count, count)
      end)

    # Apply default sort if query has no sort
    sorted_messages =
      if query.sort == [] or is_nil(query.sort) do
        Enum.sort_by(messages_with_metadata, fn msg ->
          count = Ash.Resource.get_metadata(msg, :endorsement_count)
          {-count, msg.position, msg.id}
        end)
      else
        messages_with_metadata
      end

    # Use Ash.Query.apply_to to honor filters, sorts, limits, offsets, and nested loads!
    Ash.Query.apply_to(query, sorted_messages, Ash.Context.to_opts(context))
  end
end
