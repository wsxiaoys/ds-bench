defmodule Forum.Archive.Preparations.ArchiveScope do
  use Ash.Resource.Preparation
  require Ash.Query

  @impl true
  def prepare(query, _opts, _context) do
    case query.action && query.action.name do
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
