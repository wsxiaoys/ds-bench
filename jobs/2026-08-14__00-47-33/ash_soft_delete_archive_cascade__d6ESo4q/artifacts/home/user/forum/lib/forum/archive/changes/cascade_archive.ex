defmodule Forum.Archive.Changes.CascadeArchive do
  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, _context) do
    if not is_nil(changeset.data.archived_at) do
      changeset
    else
      archived_at = changeset.context[:cascade_archived_at] || DateTime.utc_now()
      archive_batch_id = changeset.context[:cascade_archive_batch_id] || Ash.UUID.generate()

      changeset =
        changeset
        |> Ash.Changeset.force_change_attribute(:archived_at, archived_at)
        |> Ash.Changeset.force_change_attribute(:archive_batch_id, archive_batch_id)

      Ash.Changeset.before_action(changeset, fn changeset ->
        cascade_to_descendants(changeset.data, archived_at, archive_batch_id)
        changeset
      end)
    end
  end

  defp cascade_to_descendants(%Forum.Content.Post{} = post, archived_at, archive_batch_id) do
    comments =
      Forum.Content.Comment
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(post_id == ^post.id)
      |> Ash.read!()

    for comment <- comments do
      if is_nil(comment.archived_at) do
        comment
        |> Ash.Changeset.for_destroy(:archive, %{}, context: %{
          cascade_archived_at: archived_at,
          cascade_archive_batch_id: archive_batch_id
        })
        |> Ash.destroy!()
      else
        cascade_to_descendants(comment, archived_at, archive_batch_id)
      end
    end
  end

  defp cascade_to_descendants(%Forum.Content.Comment{} = comment, archived_at, archive_batch_id) do
    reactions =
      Forum.Content.Reaction
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(comment_id == ^comment.id)
      |> Ash.read!()

    for reaction <- reactions do
      if is_nil(reaction.archived_at) do
        reaction
        |> Ash.Changeset.for_destroy(:archive, %{}, context: %{
          cascade_archived_at: archived_at,
          cascade_archive_batch_id: archive_batch_id
        })
        |> Ash.destroy!()
      end
    end
  end

  defp cascade_to_descendants(%Forum.Content.Reaction{}, _archived_at, _archive_batch_id), do: :ok
end
