defmodule ThreadGraph.Forum.Threads.RecentMessages do
  use Ash.Resource.ManualRelationship
  require Ash.Query

  @impl true
  def select(_opts), do: [:id]

  @impl true
  def load(records, _opts, %{query: query} = context) do
    ThreadGraph.Forum.LoadCounter.bump(:recent_messages)

    if records == [] do
      {:ok, []}
    else
      thread_ids = Enum.map(records, & &1.id)

      fetch_query =
        query
        |> Ash.Query.ensure_selected([:thread_id])
        |> Ash.Query.filter(thread_id in ^thread_ids)
        |> Ash.Query.unset([:limit, :offset, :sort])

      messages = Ash.read!(fetch_query, Ash.Context.to_opts(context))

      messages_by_thread = Enum.group_by(messages, & &1.thread_id)

      result =
        Enum.map(records, fn thread ->
          thread_messages = Map.get(messages_by_thread, thread.id, [])

          sorted_messages =
            Enum.sort_by(thread_messages, fn msg ->
              {-msg.position, msg.id}
            end)

          Enum.take(sorted_messages, 3)
        end)

      {:ok, result}
    end
  end
end
