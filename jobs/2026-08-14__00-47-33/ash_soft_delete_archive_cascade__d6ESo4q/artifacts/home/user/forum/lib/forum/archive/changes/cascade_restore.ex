defmodule Forum.Archive.Changes.CascadeRestore do
  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, _context) do
    if is_nil(changeset.data.archived_at) do
      # Not archived: do nothing, just return changeset
      changeset
    else
      # Archived: we need to restore it
      old_batch_id = changeset.data.archive_batch_id

      changeset =
        changeset
        |> Ash.Changeset.force_change_attribute(:archived_at, nil)
        |> Ash.Changeset.force_change_attribute(:archive_batch_id, nil)

      Ash.Changeset.before_action(changeset, fn changeset ->
        cascade_restore_descendants(changeset.data, old_batch_id)
        changeset
      end)
    end
  end

  defp cascade_restore_descendants(%Forum.Content.Post{} = post, old_batch_id) do
    comments =
      Forum.Content.Comment
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(post_id == ^post.id and archive_batch_id == ^old_batch_id)
      |> Ash.read!()

    for comment <- comments do
      Ash.update!(comment, action: :restore)
    end
  end

  defp cascade_restore_descendants(%Forum.Content.Comment{} = comment, old_batch_id) do
    reactions =
      Forum.Content.Reaction
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(comment_id == ^comment.id and archive_batch_id == ^old_batch_id)
      |> Ash.read!()

    for reaction <- reactions do
      Ash.update!(reaction, action: :restore)
    end
  end

  defp cascade_restore_descendants(%Forum.Content.Reaction{}, _old_batch_id), do: :ok
end
