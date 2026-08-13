defmodule Forum.Archive.Changes.CascadeRestore do
  use Ash.Resource.Change
  require Ash.Query

  @impl true
  def change(changeset, _opts, _context) do
    target_batch_id = changeset.data.archive_batch_id

    if is_nil(target_batch_id) do
      # Target is not archived, do nothing.
      changeset
    else
      changeset =
        changeset
        |> Ash.Changeset.force_change_attribute(:archived_at, nil)
        |> Ash.Changeset.force_change_attribute(:archive_batch_id, nil)

      Ash.Changeset.before_action(changeset, fn changeset ->
        cascade_restore(changeset.data, target_batch_id)
        changeset
      end)
    end
  end

  defp cascade_restore(%Forum.Content.Post{} = post, target_batch_id) do
    comments =
      Forum.Content.Comment
      |> Ash.Query.for_read(:with_archived)
      |> Ash.Query.filter(post_id == ^post.id and archive_batch_id == ^target_batch_id)
      |> Ash.read!()

    for comment <- comments do
      comment
      |> Ash.Changeset.for_update(:restore, %{})
      |> Ash.update!()
    end
  end

  defp cascade_restore(%Forum.Content.Comment{} = comment, target_batch_id) do
    reactions =
      Forum.Content.Reaction
      |> Ash.Query.for_read(:with_archived)
      |> Ash.Query.filter(comment_id == ^comment.id and archive_batch_id == ^target_batch_id)
      |> Ash.read!()

    for reaction <- reactions do
      reaction
      |> Ash.Changeset.for_update(:restore, %{})
      |> Ash.update!()
    end
  end

  defp cascade_restore(%Forum.Content.Reaction{}, _target_batch_id) do
    :ok
  end
end
