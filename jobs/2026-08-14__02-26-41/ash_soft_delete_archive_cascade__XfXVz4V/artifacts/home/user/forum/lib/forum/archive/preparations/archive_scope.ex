defmodule Forum.Archive.Preparations.ArchiveScope do
  use Ash.Resource.Preparation

  @impl true
  def prepare(query, _opts, _context) do
    action_name = if query.action, do: query.action.name, else: :read

    case action_name do
      :read ->
        Ash.Query.filter(query, is_nil(archived_at))

      :archived ->
        Ash.Query.filter(query, not(is_nil(archived_at)))

      :with_archived ->
        query

      _ ->
        query
    end
  end
end
