defmodule ThreadGraph.Forum.Threads.RecentMessages do
  use Ash.Resource.ManualRelationship
  require Ash.Query

  @impl true
  def load(records, _opts, context) do
    ThreadGraph.Forum.LoadCounter.bump(:recent_messages)

    thread_ids = Enum.map(records, & &1.id)

    query =
      context.query
      |> Ash.Query.unset([:sort, :limit, :offset])
      |> Ash.Query.filter(thread_id in ^thread_ids)

    opts = [
      domain: context.domain,
      actor: context.actor,
      tenant: context.tenant,
      tracer: context.tracer,
      authorize?: context.authorize?
    ]

    case Ash.read(query, opts) do
      {:ok, messages} ->
        grouped = Enum.group_by(messages, & &1.thread_id)

        result_map =
          Map.new(records, fn record ->
            thread_messages = Map.get(grouped, record.id, [])

            sorted =
              Enum.sort_by(thread_messages, fn msg ->
                {msg.position, msg.id}
              end, fn {pos1, id1}, {pos2, id2} ->
                cond do
                  pos1 > pos2 -> true
                  pos1 < pos2 -> false
                  true -> id1 < id2
                end
              end)

            truncated = Enum.take(sorted, 3)
            {record.id, truncated}
          end)

        {:ok, result_map}

      {:error, error} ->
        {:error, error}
    end
  end
end
