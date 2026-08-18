defmodule Forum.Archive.Changes.CascadePurge do
  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, _context) do
    is_root = is_nil(Process.get(:cascade_purge))
    is_cascade = Process.get(:cascade_purge, false)

    if is_nil(changeset.data.archived_at) and not is_cascade do
      error = Ash.Error.Changes.InvalidChanges.exception(
        fields: [:archived_at],
        message: "must be archived before it can be purged"
      )
      Ash.Changeset.add_error(changeset, error)
    else
      changeset
      |> Ash.Changeset.after_action(fn _changeset, record ->
        if is_root do
          Process.put(:cascade_purge, true)
        end

        try do
          cascade_purge_descendants(record)
        after
          if is_root do
            Process.delete(:cascade_purge)
          end
        end

        {:ok, record}
      end)
    end
  end

  defp cascade_purge_descendants(record) do
    case record.__struct__ do
      Forum.Content.Post ->
        comments =
          Forum.Content.Comment
          |> Ash.Query.for_read(:with_archived, %{})
          |> Ash.Query.filter(post_id == ^record.id)
          |> Ash.read!(authorize?: false)

        for comment <- comments do
          Ash.destroy!(comment, action: :purge, authorize?: false)
        end

      Forum.Content.Comment ->
        reactions =
          Forum.Content.Reaction
          |> Ash.Query.for_read(:with_archived, %{})
          |> Ash.Query.filter(comment_id == ^record.id)
          |> Ash.read!(authorize?: false)

        for reaction <- reactions do
          Ash.destroy!(reaction, action: :purge, authorize?: false)
        end

      Forum.Content.Reaction ->
        :ok
    end
  end
end
