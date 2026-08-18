defmodule Forum.Archive.Changes.CascadeArchive do
  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, _context) do
    if not is_nil(changeset.data.archived_at) do
      # Already archived. Do nothing.
      changeset
    else
      # Not archived. Get from Process dictionary or generate.
      is_root = is_nil(Process.get(:cascade_archived_at))
      archived_at = Process.get(:cascade_archived_at) || DateTime.utc_now()
      archive_batch_id = Process.get(:cascade_archive_batch_id) || Ash.UUID.generate()

      changeset
      |> Ash.Changeset.force_change_attribute(:archived_at, archived_at)
      |> Ash.Changeset.force_change_attribute(:archive_batch_id, archive_batch_id)
      |> Ash.Changeset.after_action(fn _changeset, record ->
        if is_root do
          Process.put(:cascade_archived_at, archived_at)
          Process.put(:cascade_archive_batch_id, archive_batch_id)
        end

        try do
          cascade_archive_descendants(record)
        after
          if is_root do
            Process.delete(:cascade_archived_at)
            Process.delete(:cascade_archive_batch_id)
          end
        end

        {:ok, record}
      end)
    end
  end

  defp cascade_archive_descendants(record) do
    case record.__struct__ do
      Forum.Content.Post ->
        # Find all live comments of this post
        comments =
          Forum.Content.Comment
          |> Ash.Query.for_read(:read, %{})
          |> Ash.Query.filter(post_id == ^record.id)
          |> Ash.read!(authorize?: false)

        for comment <- comments do
          Ash.destroy!(comment, action: :archive, authorize?: false)
        end

      Forum.Content.Comment ->
        # Find all live reactions of this comment
        reactions =
          Forum.Content.Reaction
          |> Ash.Query.for_read(:read, %{})
          |> Ash.Query.filter(comment_id == ^record.id)
          |> Ash.read!(authorize?: false)

        for reaction <- reactions do
          Ash.destroy!(reaction, action: :archive, authorize?: false)
        end

      Forum.Content.Reaction ->
        :ok
    end
  end
end
