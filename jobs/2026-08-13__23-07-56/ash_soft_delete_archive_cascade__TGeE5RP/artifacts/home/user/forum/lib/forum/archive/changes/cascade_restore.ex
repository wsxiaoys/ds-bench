defmodule Forum.Archive.Changes.CascadeRestore do
  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, _context) do
    if is_nil(changeset.data.archived_at) do
      # Not archived. Do nothing.
      changeset
    else
      # Archived. Save the archive_batch_id before setting it to nil.
      target_batch_id = changeset.data.archive_batch_id

      changeset
      |> Ash.Changeset.force_change_attribute(:archived_at, nil)
      |> Ash.Changeset.force_change_attribute(:archive_batch_id, nil)
      |> Ash.Changeset.after_action(fn _changeset, record ->
        cascade_restore_descendants(record, target_batch_id)
        {:ok, record}
      end)
    end
  end

  defp cascade_restore_descendants(record, target_batch_id) do
    if not is_nil(target_batch_id) do
      case record.__struct__ do
        Forum.Content.Post ->
          # Find comments with the matching archive_batch_id
          comments =
            Forum.Content.Comment
            |> Ash.Query.for_read(:with_archived, %{})
            |> Ash.Query.filter(post_id == ^record.id and archive_batch_id == ^target_batch_id)
            |> Ash.read!(authorize?: false)

          for comment <- comments do
            Ash.update!(comment, action: :restore, authorize?: false)
          end

        Forum.Content.Comment ->
          # Find reactions with the matching archive_batch_id
          reactions =
            Forum.Content.Reaction
            |> Ash.Query.for_read(:with_archived, %{})
            |> Ash.Query.filter(comment_id == ^record.id and archive_batch_id == ^target_batch_id)
            |> Ash.read!(authorize?: false)

          for reaction <- reactions do
            Ash.update!(reaction, action: :restore, authorize?: false)
          end

        Forum.Content.Reaction ->
          :ok
      end
    else
      :ok
    end
  end
end
