defmodule Forum.Archive.Changes.CascadeArchive do
  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, _context) do
    if changeset.data.archived_at do
      changeset
    else
      batch_id = changeset.context[:archive_batch_id] || Ash.UUID.generate()
      now = changeset.context[:archived_at] || (DateTime.utc_now() |> DateTime.truncate(:microsecond))

      changeset =
        changeset
        |> Ash.Changeset.force_change_attribute(:archived_at, now)
        |> Ash.Changeset.force_change_attribute(:archive_batch_id, batch_id)

      Ash.Changeset.after_action(changeset, fn _changeset, record ->
        resource = record.__struct__

        if resource == Forum.Content.Post do
          comments =
            Forum.Content.Comment
            |> Ash.Query.for_read(:with_archived, %{})
            |> Ash.Query.filter(post_id == ^record.id and is_nil(archived_at))
            |> Ash.read!(authorize?: false)

          Enum.each(comments, fn comment ->
            comment
            |> Ash.Changeset.new()
            |> Ash.Changeset.set_context(%{archive_batch_id: batch_id, archived_at: now})
            |> Ash.Changeset.for_destroy(:archive, %{})
            |> Ash.destroy!(authorize?: false)
          end)
        end

        if resource == Forum.Content.Comment do
          reactions =
            Forum.Content.Reaction
            |> Ash.Query.for_read(:with_archived, %{})
            |> Ash.Query.filter(comment_id == ^record.id and is_nil(archived_at))
            |> Ash.read!(authorize?: false)

          Enum.each(reactions, fn reaction ->
            reaction
            |> Ash.Changeset.new()
            |> Ash.Changeset.set_context(%{archive_batch_id: batch_id, archived_at: now})
            |> Ash.Changeset.for_destroy(:archive, %{})
            |> Ash.destroy!(authorize?: false)
          end)
        end

        {:ok, record}
      end)
    end
  end
end
