defmodule Forum.Archive.Validations.MustBeArchived do
  use Ash.Resource.Validation

  @impl true
  def validate(changeset, _opts, _context) do
    if changeset.context[:cascading?] || not is_nil(changeset.data.archived_at) do
      :ok
    else
      {:error, Ash.Error.Changes.InvalidChanges.exception(fields: [:archived_at], message: "must be archived before it can be purged")}
    end
  end
end
