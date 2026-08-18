defmodule ThreadGraph.Forum.Threads.ForkThread do
  use Ash.Resource.ManualCreate
  require Ash.Query

  @impl true
  def create(changeset, _opts, context) do
    ThreadGraph.Forum.LoadCounter.bump(:fork)

    source_message_id = Ash.Changeset.get_argument(changeset, :source_message_id)
    slug = Ash.Changeset.get_argument(changeset, :slug)
    title = Ash.Changeset.get_argument(changeset, :title)

    read_opts = [
      actor: context.actor,
      tenant: context.tenant,
      tracer: context.tracer,
      authorize?: context.authorize?
    ]

    query =
      ThreadGraph.Forum.Message
      |> Ash.Query.filter(id == ^source_message_id)
      |> Ash.Query.load([:thread])

    case Ash.read(query, read_opts) do
      {:ok, [s]} ->
        if s.thread.locked do
          {:error,
           Ash.Error.Changes.InvalidArgument.exception(
             field: :source_message_id,
             message: "source thread is locked",
             value: source_message_id
           )}
        else
          # Proceed with fork
          # Fetch all messages in the source thread to find descendants
          case Ash.read(
                 Ash.Query.filter(ThreadGraph.Forum.Message, thread_id == ^s.thread_id),
                 read_opts
               ) do
            {:ok, thread_messages} ->
              by_parent = Enum.group_by(thread_messages, & &1.parent_id)
              descendants = get_descendants(s.id, by_parent)
              originals = [s | descendants]

              # Sort copied originals by position ascending, ties broken by id ascending
              sorted_originals =
                Enum.sort_by(originals, fn msg ->
                  {msg.position, msg.id}
                end, fn {pos1, id1}, {pos2, id2} ->
                  cond do
                    pos1 < pos2 -> true
                    pos1 > pos2 -> false
                    true -> id1 < id2
                  end
                end)

              originals_with_positions = Enum.with_index(sorted_originals, 1)

              # Generate new UUIDs for the copies
              id_mapping = Map.new(originals, &{&1.id, Ash.UUID.generate()})

              # Create the new thread
              new_thread =
                Ash.create!(
                  ThreadGraph.Forum.Thread,
                  %{
                    slug: slug,
                    title: title,
                    board: s.thread.board,
                    locked: false
                  },
                  read_opts
                )

              # Create message copies
              Enum.each(originals_with_positions, fn {orig, index} ->
                parent_id =
                  if orig.id == s.id do
                    nil
                  else
                    Map.get(id_mapping, orig.parent_id)
                  end

                changeset =
                  ThreadGraph.Forum.Message
                  |> Ash.Changeset.for_create(:create, %{
                    body: orig.body,
                    position: index,
                    score: orig.score,
                    author_id: orig.author_id,
                    thread_id: new_thread.id,
                    parent_id: parent_id
                  })
                  |> Ash.Changeset.force_change_attribute(:id, Map.fetch!(id_mapping, orig.id))

                Ash.create!(changeset, read_opts)
              end)

              # Create the MessageLink
              copy_of_s_id = Map.fetch!(id_mapping, s.id)

              Ash.create!(
                ThreadGraph.Forum.MessageLink,
                %{
                  kind: :fork_of,
                  from_message_id: copy_of_s_id,
                  to_message_id: s.id
                },
                read_opts
              )

              {:ok, new_thread}

            {:error, error} ->
              {:error, error}
          end
        end

      _ ->
        {:error,
         Ash.Error.Changes.InvalidArgument.exception(
           field: :source_message_id,
           message: "source message not found",
           value: source_message_id
         )}
    end
  end

  defp get_descendants(msg_id, by_parent, visited \\ MapSet.new()) do
    if MapSet.member?(visited, msg_id) do
      []
    else
      visited = MapSet.put(visited, msg_id)
      children = Map.get(by_parent, msg_id, [])
      children ++ Enum.flat_map(children, &get_descendants(&1.id, by_parent, visited))
    end
  end
end
