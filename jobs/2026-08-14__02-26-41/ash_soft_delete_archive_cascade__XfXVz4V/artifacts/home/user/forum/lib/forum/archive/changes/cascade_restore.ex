defmodule Forum.Archive.Changes.CascadeRestore do
  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, _context) do
    if is_nil(changeset.data.archived_at) do
      changeset
    else
      old_batch_id = changeset.data.archive_batch_id

      changeset =
        changeset
        |> Ash.Changeset.force_change_attribute(:archived_at, nil)
        |> Ash.Changeset.force_change_attribute(:archive_batch_id, nil)

      if old_batch_id do
        Ash.Changeset.after_action(changeset, fn _changeset, record ->
          resource = record.__struct__

          if resource == Forum.Content.Post do
            comments =
              Forum.Content.Comment
              |> Ash.Query.for_read(:with_archived, %{})
              |> Ash.Query.filter(post_id == ^record.id and archive_batch_id == ^old_batch_id)
              |> Ash.read!(authorize?: false)

            Enum.each(comments, fn comment ->
              comment
              |> Ash.Changeset.for_update(:restore, %{})
              |> Ash.update!(authorize?: false)
            end)
          end

          if resource == Forum.Content.Comment do
            reactions =
              Forum.Content.Reaction
              |> Ash.Query.for_read(:with_archived, %{})
              |> Ash.Query.filter(comment_id == ^record.id and archive_batch_id == ^old_batch_id)
              |> Ash.read!(authorize?: false)

            Enum.each(reactions, fn reaction ->
              reaction
              |> Ash.Changeset.for_update(:restore, %{})
              |> Ash.update!(authorize?: false)
            end)
          end

          {:ok, record}
        end)
      else
        changeset
      end
    end
  end
end
