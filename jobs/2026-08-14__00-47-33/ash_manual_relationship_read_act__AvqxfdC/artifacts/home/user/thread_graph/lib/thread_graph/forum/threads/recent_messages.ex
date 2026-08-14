defmodule ThreadGraph.Forum.Threads.RecentMessages do
  @moduledoc """
  Implements the manual relationship `recent_messages` on Thread.
  """
  use Ash.Resource.ManualRelationship
  require Ash.Query

  @impl true
  def load(records, _opts, context) do
    ThreadGraph.Forum.LoadCounter.bump(:recent_messages)

    thread_ids = Enum.map(records, & &1.id)

    # Clear limit/offset/sort from the load query so they don't affect our candidates
    clean_query =
      context.query
      |> Map.put(:limit, nil)
      |> Map.put(:offset, nil)
      |> Map.put(:sort, [])
      |> Ash.Query.filter(thread_id in ^thread_ids)

    messages = Ash.read!(clean_query, Ash.Context.to_opts(context))
    messages_by_thread = Enum.group_by(messages, & &1.thread_id)

    results =
      Enum.map(records, fn thread ->
        thread_messages = Map.get(messages_by_thread, thread.id, [])

        thread_messages
        |> Enum.sort_by(fn msg -> {msg.position, msg.id} end, fn {pos1, id1}, {pos2, id2} ->
          cond do
            pos1 > pos2 -> true
            pos1 < pos2 -> false
            true -> id1 < id2
          end
        end)
        |> Enum.take(3)
      end)

    {:ok, results}
  end
end
