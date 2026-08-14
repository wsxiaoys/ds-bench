defmodule Forum.Archive.Changes.CascadePurge do
  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, _context) do
    Ash.Changeset.before_action(changeset, fn changeset ->
      cascade_purge_descendants(changeset.data)
      changeset
    end)
  end

  defp cascade_purge_descendants(%Forum.Content.Post{} = post) do
    comments =
      Forum.Content.Comment
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(post_id == ^post.id)
      |> Ash.read!()

    for comment <- comments do
      comment
      |> Ash.Changeset.for_destroy(:purge, %{}, context: %{bypass_archived_check: true})
      |> Ash.destroy!()
    end
  end

  defp cascade_purge_descendants(%Forum.Content.Comment{} = comment) do
    reactions =
      Forum.Content.Reaction
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(comment_id == ^comment.id)
      |> Ash.read!()

    for reaction <- reactions do
      reaction
      |> Ash.Changeset.for_destroy(:purge, %{}, context: %{bypass_archived_check: true})
      |> Ash.destroy!()
    end
  end

  defp cascade_purge_descendants(%Forum.Content.Reaction{}), do: :ok
end
