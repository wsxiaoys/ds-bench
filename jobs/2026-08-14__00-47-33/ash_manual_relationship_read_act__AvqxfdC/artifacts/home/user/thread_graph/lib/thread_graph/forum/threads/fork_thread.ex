defmodule ThreadGraph.Forum.Threads.ForkThread do
  @moduledoc """
  Implements the manual create action `fork` on Thread.
  """
  use Ash.Resource.ManualCreate
  require Ash.Query

  @impl true
  def create(changeset, _opts, context) do
    ThreadGraph.Forum.LoadCounter.bump(:fork)

    source_message_id = Ash.Changeset.get_argument(changeset, :source_message_id)
    slug = Ash.Changeset.get_argument(changeset, :slug)
    title = Ash.Changeset.get_argument(changeset, :title)

    # 1. Fetch source message S
    source_msg =
      ThreadGraph.Forum.Message
      |> Ash.Query.filter(id == ^source_message_id)
      |> Ash.read_one(Ash.Context.to_opts(context))

    case source_msg do
      {:ok, nil} ->
        {:error, Ash.Error.Changes.InvalidArgument.exception(
          field: :source_message_id,
          message: "source message not found",
          value: source_message_id
        )}

      {:ok, source_msg} ->
        # Load thread to check if locked
        source_msg = Ash.load!(source_msg, :thread, Ash.Context.to_opts(context))

        if source_msg.thread.locked do
          {:error, Ash.Error.Changes.InvalidArgument.exception(
            field: :source_message_id,
            message: "source thread is locked",
            value: source_message_id
          )}
        else
          # Proceed with creating the new thread and copying messages

          # Fetch all messages to construct descendants tree
          all_messages = Ash.read!(ThreadGraph.Forum.Message, Ash.Context.to_opts(context))
        children_map = Enum.group_by(all_messages, & &1.parent_id)

          # Find S and all its transitive descendants
          copied_originals = get_descendants(source_msg, children_map)

          # Sort the copied originals by position ascending, ties broken by id ascending
          originals_sorted =
            copied_originals
            |> Enum.sort_by(fn msg -> {msg.position, msg.id} end, fn {pos1, id1}, {pos2, id2} ->
              cond do
                pos1 < pos2 -> true
                pos1 > pos2 -> false
                true -> id1 < id2
              end
            end)

          # Create the new thread
          new_thread =
            ThreadGraph.Forum.Thread
            |> Ash.Changeset.for_create(:create, %{
              slug: slug,
              title: title,
              board: source_msg.thread.board,
              locked: false
            })
            |> Ash.create!(Ash.Context.to_opts(context))

          # Generate new UUIDs for all copies upfront
          id_map = Map.new(originals_sorted, fn msg -> {msg.id, Ash.UUID.generate()} end)

          # Create copies of messages
          Enum.with_index(originals_sorted)
          |> Enum.each(fn {msg, idx} ->
            new_parent_id =
              if msg.id == source_msg.id do
                nil
              else
                case msg.parent_id do
                  nil -> nil
                  orig_parent_id -> Map.get(id_map, orig_parent_id)
                end
              end

            ThreadGraph.Forum.Message
            |> Ash.Changeset.for_create(:create, %{
              body: msg.body,
              position: idx + 1,
              score: msg.score,
              thread_id: new_thread.id,
              author_id: msg.author_id,
              parent_id: new_parent_id
            })
            |> Ash.Changeset.force_change_attribute(:id, Map.fetch!(id_map, msg.id))
            |> Ash.create!(Ash.Context.to_opts(context))
          end)

          # Create fork_of link
          copy_of_s_id = Map.fetch!(id_map, source_msg.id)

          ThreadGraph.Forum.MessageLink
          |> Ash.Changeset.for_create(:create, %{
            kind: :fork_of,
            from_message_id: copy_of_s_id,
            to_message_id: source_msg.id
          })
          |> Ash.create!(Ash.Context.to_opts(context))

          {:ok, new_thread}
        end
    end
  end

  defp get_descendants(msg, children_map) do
    do_get_descendants([msg], children_map, [], MapSet.new())
  end

  defp do_get_descendants([], _children_map, acc, _visited), do: Enum.reverse(acc)
  defp do_get_descendants([current | rest], children_map, acc, visited) do
    if MapSet.member?(visited, current.id) do
      do_get_descendants(rest, children_map, acc, visited)
    else
      children = Map.get(children_map, current.id, [])
      do_get_descendants(children ++ rest, children_map, [current | acc], MapSet.put(visited, current.id))
    end
  end
end
