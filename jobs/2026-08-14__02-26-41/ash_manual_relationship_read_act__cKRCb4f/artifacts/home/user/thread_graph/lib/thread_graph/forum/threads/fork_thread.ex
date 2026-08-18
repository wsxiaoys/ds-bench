defmodule ThreadGraph.Forum.Threads.ForkThread do
  use Ash.Resource.ManualCreate
  require Ash.Query

  @impl true
  def create(changeset, _opts, context) do
    ThreadGraph.Forum.LoadCounter.bump(:fork)

    source_message_id = changeset.arguments[:source_message_id]
    slug = changeset.arguments[:slug]
    title = changeset.arguments[:title]

    # Find S
    case ThreadGraph.Forum.Message
         |> Ash.Query.new()
         |> Ash.Query.filter(id == ^source_message_id)
         |> Ash.Query.load(:thread)
         |> Ash.read_one(Ash.Context.to_opts(context)) do
      {:ok, nil} ->
        {:error, %Ash.Error.Changes.InvalidArgument{
          field: :source_message_id,
          message: "source message not found",
          value: source_message_id
        }}

      {:ok, s} ->
        if s.thread.locked do
          {:error, %Ash.Error.Changes.InvalidArgument{
            field: :source_message_id,
            message: "source thread is locked",
            value: source_message_id
          }}
        else
          # Fetch all messages in the database
          all_messages =
            ThreadGraph.Forum.Message
            |> Ash.Query.new()
            |> Ash.read!(Ash.Context.to_opts(context))

          # Build parent-child map
          children_by_parent_id = Enum.group_by(all_messages, & &1.parent_id)

          # Get S and all transitive descendants
          original_messages = get_descendants(s, children_by_parent_id, MapSet.new())

          # Sort the copied originals by position ascending, ties broken by id ascending
          sorted_originals =
            original_messages
            |> Enum.sort_by(fn msg -> {msg.position, msg.id} end)

          # Generate mapping from original_id to new_id
          mapping =
            original_messages
            |> Map.new(fn msg -> {msg.id, Ash.UUID.generate()} end)

          # Create the new thread
          new_thread =
            ThreadGraph.Forum.Thread
            |> Ash.Changeset.for_create(:create, %{
              slug: slug,
              title: title,
              board: s.thread.board,
              locked: false
            })
            |> Ash.create!(Ash.Context.to_opts(context))

          # Create copies of original messages
          Enum.each(Enum.with_index(sorted_originals, 1), fn {msg, pos} ->
            copy_id = Map.get(mapping, msg.id)
            copy_parent_id =
              if msg.id == s.id do
                nil
              else
                Map.get(mapping, msg.parent_id)
              end

            ThreadGraph.Forum.Message
            |> Ash.Changeset.for_create(:create, %{
              body: msg.body,
              position: pos,
              score: msg.score,
              thread_id: new_thread.id,
              author_id: msg.author_id,
              parent_id: copy_parent_id
            })
            |> Ash.Changeset.force_change_attribute(:id, copy_id)
            |> Ash.create!(Ash.Context.to_opts(context))
          end)

          # Create exactly one new ThreadGraph.Forum.MessageLink with kind: :fork_of,
          # from_message_id set to the id of the copy of S, and to_message_id set to S.id.
          copy_s_id = Map.get(mapping, s.id)
          ThreadGraph.Forum.MessageLink
          |> Ash.Changeset.for_create(:create, %{
            kind: :fork_of,
            from_message_id: copy_s_id,
            to_message_id: s.id
          })
          |> Ash.create!(Ash.Context.to_opts(context))

          {:ok, new_thread}
        end
    end
  end

  defp get_descendants(msg, children_by_parent_id, visited) do
    if MapSet.member?(visited, msg.id) do
      []
    else
      visited = MapSet.put(visited, msg.id)
      children = Map.get(children_by_parent_id, msg.id, [])
      [msg | Enum.flat_map(children, &get_descendants(&1, children_by_parent_id, visited))]
    end
  end
end
