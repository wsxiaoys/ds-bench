defmodule ForumTest do
  use ExUnit.Case

  require Ash.Query

  alias Forum.Content.{Post, Comment, Reaction}

  test "create and read resources" do
    post =
      Post
      |> Ash.Changeset.for_create(:create, %{title: "My Post"})
      |> Ash.create!(authorize?: false)

    assert post.title == "My Post"
    assert is_nil(post.archived_at)
    assert is_nil(post.archive_batch_id)

    comment =
      Comment
      |> Ash.Changeset.for_create(:create, %{body: "My Comment", post_id: post.id})
      |> Ash.create!(authorize?: false)

    assert comment.body == "My Comment"
    assert comment.post_id == post.id

    reaction =
      Reaction
      |> Ash.Changeset.for_create(:create, %{emoji: "👍", comment_id: comment.id})
      |> Ash.create!(authorize?: false)

    assert reaction.emoji == "👍"
    assert reaction.comment_id == comment.id
  end

  test "read scoping and global read scoping" do
    post =
      Post
      |> Ash.Changeset.for_create(:create, %{title: "Post 1"})
      |> Ash.create!(authorize?: false)

    comment1 =
      Comment
      |> Ash.Changeset.for_create(:create, %{body: "Comment 1", post_id: post.id})
      |> Ash.create!(authorize?: false)

    comment2_live =
      Comment
      |> Ash.Changeset.for_create(:create, %{body: "Comment 2", post_id: post.id})
      |> Ash.create!(authorize?: false)

    # Archive comment2
    comment2_live
    |> Ash.Changeset.for_destroy(:archive, %{})
    |> Ash.destroy!(authorize?: false)

    # Fetching post and loading comments
    loaded_post =
      Post
      |> Ash.get!(post.id, authorize?: false)
      |> Ash.load!([:comments, :comment_count], authorize?: false)

    # comment2 must not leak into relationship loads
    assert length(loaded_post.comments) == 1
    assert hd(loaded_post.comments).id == comment1.id

    # comment2 must not leak into aggregates
    assert loaded_post.comment_count == 1

    # Fetching archived comment2 through primary read must produce Ash.Error.Query.NotFound
    assert {:error, error} = Ash.get(Comment, comment2_live.id, authorize?: false)
    invalid_error = Ash.Error.to_error_class(error)
    assert %Ash.Error.Invalid{errors: [not_found | _]} = invalid_error
    assert %Ash.Error.Query.NotFound{} = not_found

    # Fetching archived comment2 with :with_archived must succeed
    comment2_fetched =
      Comment
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(id == ^comment2_live.id)
      |> Ash.read_one!(authorize?: false)

    assert comment2_fetched != nil
    assert comment2_fetched.id == comment2_live.id
    assert comment2_fetched.archived_at != nil
  end

  test "archive semantics - cascade and generations" do
    post =
      Post
      |> Ash.Changeset.for_create(:create, %{title: "Post 1"})
      |> Ash.create!(authorize?: false)

    comment1 =
      Comment
      |> Ash.Changeset.for_create(:create, %{body: "Comment 1", post_id: post.id})
      |> Ash.create!(authorize?: false)

    # already archived comment
    comment2_live =
      Comment
      |> Ash.Changeset.for_create(:create, %{body: "Comment 2", post_id: post.id})
      |> Ash.create!(authorize?: false)

    comment2_live
    |> Ash.Changeset.for_destroy(:archive, %{})
    |> Ash.destroy!(authorize?: false)

    comment2 =
      Comment
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(id == ^comment2_live.id)
      |> Ash.read_one!(authorize?: false)

    # wait a moment to ensure timestamp difference if any
    Process.sleep(10)

    # archive the post
    post
    |> Ash.Changeset.for_destroy(:archive, %{})
    |> Ash.destroy!(authorize?: false)

    archived_post =
      Post
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(id == ^post.id)
      |> Ash.read_one!(authorize?: false)

    assert archived_post.archived_at != nil
    assert archived_post.archive_batch_id != nil

    # Fetch descendants
    comment1_archived =
      Comment
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(id == ^comment1.id)
      |> Ash.read_one!(authorize?: false)

    comment2_archived =
      Comment
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(id == ^comment2.id)
      |> Ash.read_one!(authorize?: false)

    # comment1 was live, so it must be archived together with post (same batch_id and archived_at)
    assert comment1_archived.archived_at == archived_post.archived_at
    assert comment1_archived.archive_batch_id == archived_post.archive_batch_id

    # comment2 was already archived, so it must keep its original values byte-for-byte
    assert comment2_archived.archived_at == comment2.archived_at
    assert comment2_archived.archive_batch_id == comment2.archive_batch_id
    assert comment2_archived.archive_batch_id != archived_post.archive_batch_id
  end

  test "restore semantics - precise restore" do
    post =
      Post
      |> Ash.Changeset.for_create(:create, %{title: "Post 1"})
      |> Ash.create!(authorize?: false)

    comment1 =
      Comment
      |> Ash.Changeset.for_create(:create, %{body: "Comment 1", post_id: post.id})
      |> Ash.create!(authorize?: false)

    # comment2 already archived before post is archived
    comment2_live =
      Comment
      |> Ash.Changeset.for_create(:create, %{body: "Comment 2", post_id: post.id})
      |> Ash.create!(authorize?: false)

    comment2_live
    |> Ash.Changeset.for_destroy(:archive, %{})
    |> Ash.destroy!(authorize?: false)

    comment2 =
      Comment
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(id == ^comment2_live.id)
      |> Ash.read_one!(authorize?: false)

    # archive post (this archives post and comment1 as one generation)
    post
    |> Ash.Changeset.for_destroy(:archive, %{})
    |> Ash.destroy!(authorize?: false)

    archived_post =
      Post
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(id == ^post.id)
      |> Ash.read_one!(authorize?: false)

    # restore post
    restored_post =
      archived_post
      |> Ash.Changeset.for_update(:restore, %{})
      |> Ash.update!(authorize?: false)

    assert is_nil(restored_post.archived_at)
    assert is_nil(restored_post.archive_batch_id)

    # comment1 (which was archived in the same generation) must be restored
    comment1_restored =
      Comment
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(id == ^comment1.id)
      |> Ash.read_one!(authorize?: false)

    assert is_nil(comment1_restored.archived_at)
    assert is_nil(comment1_restored.archive_batch_id)

    # comment2 (which had a different batch_id) must remain archived
    comment2_restored =
      Comment
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(id == ^comment2.id)
      |> Ash.read_one!(authorize?: false)

    assert comment2_restored.archived_at == comment2.archived_at
    assert comment2_restored.archive_batch_id == comment2.archive_batch_id
  end

  test "purge semantics - validation and permanent deletion" do
    post =
      Post
      |> Ash.Changeset.for_create(:create, %{title: "Live Post"})
      |> Ash.create!(authorize?: false)

    # Purging a live record must fail with specific error
    result =
      post
      |> Ash.Changeset.for_destroy(:purge, %{})
      |> Ash.destroy(authorize?: false)

    assert {:error, %Ash.Error.Invalid{errors: errors}} = result
    assert Enum.any?(errors, fn
      %Ash.Error.Changes.InvalidChanges{fields: [:archived_at], message: "must be archived before it can be purged"} -> true
      _ -> false
    end)

    # Archive and then purge
    post
    |> Ash.Changeset.for_destroy(:archive, %{})
    |> Ash.destroy!(authorize?: false)

    archived_post =
      Post
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(id == ^post.id)
      |> Ash.read_one!(authorize?: false)

    _comment =
      Comment
      |> Ash.Changeset.for_create(:create, %{body: "Comment", post_id: archived_post.id})
      |> Ash.create!(authorize?: false)
  end

  test "purge deletes descendants recursively" do
    post =
      Post
      |> Ash.Changeset.for_create(:create, %{title: "Post to Purge"})
      |> Ash.create!(authorize?: false)

    comment =
      Comment
      |> Ash.Changeset.for_create(:create, %{body: "Comment to Purge", post_id: post.id})
      |> Ash.create!(authorize?: false)

    reaction =
      Reaction
      |> Ash.Changeset.for_create(:create, %{emoji: "🎉", comment_id: comment.id})
      |> Ash.create!(authorize?: false)

    # Archive post (and cascade to descendants)
    post
    |> Ash.Changeset.for_destroy(:archive, %{})
    |> Ash.destroy!(authorize?: false)

    archived_post =
      Post
      |> Ash.Query.for_read(:with_archived, %{})
      |> Ash.Query.filter(id == ^post.id)
      |> Ash.read_one!(authorize?: false)

    # Purge post
    archived_post
    |> Ash.Changeset.for_destroy(:purge, %{})
    |> Ash.destroy!(authorize?: false)

    # Assert all are completely gone from storage
    assert [] ==
             Post
             |> Ash.Query.for_read(:with_archived, %{})
             |> Ash.Query.filter(id == ^post.id)
             |> Ash.read!(authorize?: false)

    assert [] ==
             Comment
             |> Ash.Query.for_read(:with_archived, %{})
             |> Ash.Query.filter(id == ^comment.id)
             |> Ash.read!(authorize?: false)

    assert [] ==
             Reaction
             |> Ash.Query.for_read(:with_archived, %{})
             |> Ash.Query.filter(id == ^reaction.id)
             |> Ash.read!(authorize?: false)
  end

  test "authorization policies" do
    # With authorization enabled:
    # :archived read must be reachable only by admin.
    # other actions permitted for every actor, including nil.

    admin = %{role: :admin}
    user = %{role: :user}
    guest = nil

    # Create post (permitted for guest)
    post =
      Post
      |> Ash.Changeset.for_create(:create, %{title: "Auth Post"})
      |> Ash.create!(actor: guest, authorize?: true)

    # Archive post (permitted for guest)
    post
    |> Ash.Changeset.for_destroy(:archive, %{})
    |> Ash.destroy!(actor: guest, authorize?: true)

    # Read :archived with admin (succeeds)
    archived_posts_admin =
      Post
      |> Ash.Query.for_read(:archived, %{})
      |> Ash.read!(actor: admin, authorize?: true)

    assert length(archived_posts_admin) > 0

    # Read :archived with non-admin user (fails with Forbidden)
    assert {:error, %Ash.Error.Forbidden{}} =
             Post
             |> Ash.Query.for_read(:archived, %{})
             |> Ash.read(actor: user, authorize?: true)

    # Read :archived with guest/nil (fails with Forbidden)
    assert {:error, %Ash.Error.Forbidden{}} =
             Post
             |> Ash.Query.for_read(:archived, %{})
             |> Ash.read(actor: guest, authorize?: true)
  end
end
