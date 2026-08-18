defmodule ForumTest do
  use ExUnit.Case
  require Ash.Query

  alias Forum.Content.{Post, Comment, Reaction}

  setup do
    # Clear ETS tables if they exist
    if :ets.info(Post) != :undefined, do: :ets.delete_all_objects(Post)
    if :ets.info(Comment) != :undefined, do: :ets.delete_all_objects(Comment)
    if :ets.info(Reaction) != :undefined, do: :ets.delete_all_objects(Reaction)
    :ok
  end

  describe "basic creation and retrieval" do
    test "can create post, comment, and reaction" do
      post = Post |> Ash.Changeset.for_create(:create, %{title: "Post 1"}) |> Ash.create!(authorize?: false)
      assert post.title == "Post 1"
      assert is_nil(post.archived_at)
      assert is_nil(post.archive_batch_id)

      comment = Comment |> Ash.Changeset.for_create(:create, %{body: "Comment 1", post_id: post.id}) |> Ash.create!(authorize?: false)
      assert comment.body == "Comment 1"
      assert comment.post_id == post.id

      reaction = Reaction |> Ash.Changeset.for_create(:create, %{emoji: "👍", comment_id: comment.id}) |> Ash.create!(authorize?: false)
      assert reaction.emoji == "👍"
      assert reaction.comment_id == comment.id
    end
  end

  describe "read scoping and aggregates" do
    test "primary read action filters out archived records" do
      post1 = Post |> Ash.Changeset.for_create(:create, %{title: "Live Post"}) |> Ash.create!(authorize?: false)
      post2 = Post |> Ash.Changeset.for_create(:create, %{title: "Archived Post"}) |> Ash.create!(authorize?: false)

      # Archive post2
      :ok = Ash.destroy!(post2, action: :archive, authorize?: false)

      # Ordinary read
      live_posts = Post |> Ash.Query.for_read(:read, %{}) |> Ash.read!(authorize?: false)
      assert length(live_posts) == 1
      assert hd(live_posts).id == post1.id

      # Archived read
      archived_posts = Post |> Ash.Query.for_read(:archived, %{}) |> Ash.read!(authorize?: false)
      assert length(archived_posts) == 1
      assert hd(archived_posts).id == post2.id

      # With archived read
      all_posts = Post |> Ash.Query.for_read(:with_archived, %{}) |> Ash.read!(authorize?: false)
      assert length(all_posts) == 2

      # Ash.get/3 with default read should fail for archived post
      assert {:error, error} = Ash.get(Post, post2.id, authorize?: false)
      assert match?(%Ash.Error.Query.NotFound{}, error) or
             (match?(%Ash.Error.Invalid{}, error) and Enum.any?(error.errors, &match?(%Ash.Error.Query.NotFound{}, &1)))

      # Ash.get/3 with default read should succeed for live post
      assert Ash.get!(Post, post1.id, authorize?: false).id == post1.id
    end

    test "relationship loads and aggregates exclude archived records" do
      post = Post |> Ash.Changeset.for_create(:create, %{title: "Post"}) |> Ash.create!(authorize?: false)
      comment1 = Comment |> Ash.Changeset.for_create(:create, %{body: "Live Comment", post_id: post.id}) |> Ash.create!(authorize?: false)
      comment2 = Comment |> Ash.Changeset.for_create(:create, %{body: "Archived Comment", post_id: post.id}) |> Ash.create!(authorize?: false)

      # Archive comment2
      :ok = Ash.destroy!(comment2, action: :archive, authorize?: false)

      # Load comments on post
      post = Ash.load!(post, [:comments, :comment_count], authorize?: false)
      assert length(post.comments) == 1
      assert hd(post.comments).id == comment1.id
      assert post.comment_count == 1
    end
  end

  describe "archive semantics" do
    test "archiving a post cascades to comments and reactions" do
      post = Post |> Ash.Changeset.for_create(:create, %{title: "Post"}) |> Ash.create!(authorize?: false)
      comment = Comment |> Ash.Changeset.for_create(:create, %{body: "Comment", post_id: post.id}) |> Ash.create!(authorize?: false)
      reaction = Reaction |> Ash.Changeset.for_create(:create, %{emoji: "👍", comment_id: comment.id}) |> Ash.create!(authorize?: false)

      # Archive post
      :ok = Ash.destroy!(post, action: :archive, authorize?: false)

      # Fetch post, comment and reaction including archived
      post = Post |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: post.id) |> Ash.read_one!(authorize?: false)
      assert not is_nil(post.archived_at)
      assert not is_nil(post.archive_batch_id)

      comment = Comment |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: comment.id) |> Ash.read_one!(authorize?: false)
      reaction = Reaction |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: reaction.id) |> Ash.read_one!(authorize?: false)

      assert comment.archived_at == post.archived_at
      assert comment.archive_batch_id == post.archive_batch_id

      assert reaction.archived_at == post.archived_at
      assert reaction.archive_batch_id == post.archive_batch_id
    end

    test "archiving already archived record does nothing" do
      post = Post |> Ash.Changeset.for_create(:create, %{title: "Post"}) |> Ash.create!(authorize?: false)
      :ok = Ash.destroy!(post, action: :archive, authorize?: false)

      post = Post |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: post.id) |> Ash.read_one!(authorize?: false)
      original_archived_at = post.archived_at
      original_batch_id = post.archive_batch_id

      # Archive again
      :ok = Ash.destroy!(post, action: :archive, authorize?: false)

      post_again = Post |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: post.id) |> Ash.read_one!(authorize?: false)
      assert post_again.archived_at == original_archived_at
      assert post_again.archive_batch_id == original_batch_id
    end

    test "does not modify already archived descendants" do
      post = Post |> Ash.Changeset.for_create(:create, %{title: "Post"}) |> Ash.create!(authorize?: false)
      comment1 = Comment |> Ash.Changeset.for_create(:create, %{body: "Comment 1", post_id: post.id}) |> Ash.create!(authorize?: false)
      comment2 = Comment |> Ash.Changeset.for_create(:create, %{body: "Comment 2", post_id: post.id}) |> Ash.create!(authorize?: false)

      # Archive comment1 first
      :ok = Ash.destroy!(comment1, action: :archive, authorize?: false)

      comment1 = Comment |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: comment1.id) |> Ash.read_one!(authorize?: false)
      assert not is_nil(comment1.archive_batch_id)

      # Archive post
      :ok = Ash.destroy!(post, action: :archive, authorize?: false)

      post = Post |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: post.id) |> Ash.read_one!(authorize?: false)

      # Fetch comment1 and comment2
      comment1_after = Comment |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: comment1.id) |> Ash.read_one!(authorize?: false)
      comment2_after = Comment |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: comment2.id) |> Ash.read_one!(authorize?: false)

      # comment1 should keep its original archive values
      assert comment1_after.archive_batch_id == comment1.archive_batch_id
      assert comment1_after.archived_at == comment1.archived_at

      # comment2 should have the post's archive values
      assert comment2_after.archive_batch_id == post.archive_batch_id
      assert comment2_after.archived_at == post.archived_at
    end
  end

  describe "restore semantics" do
    test "restoring a live record does nothing" do
      post = Post |> Ash.Changeset.for_create(:create, %{title: "Post"}) |> Ash.create!(authorize?: false)
      restored = post |> Ash.Changeset.for_update(:restore, %{}) |> Ash.update!(authorize?: false)
      assert is_nil(restored.archived_at)
    end

    test "restoring an archived post restores matching descendants recursively" do
      post = Post |> Ash.Changeset.for_create(:create, %{title: "Post"}) |> Ash.create!(authorize?: false)
      comment1 = Comment |> Ash.Changeset.for_create(:create, %{body: "Comment 1", post_id: post.id}) |> Ash.create!(authorize?: false)
      comment2 = Comment |> Ash.Changeset.for_create(:create, %{body: "Comment 2", post_id: post.id}) |> Ash.create!(authorize?: false)

      # Archive comment1 first
      :ok = Ash.destroy!(comment1, action: :archive, authorize?: false)
      comment1_archived = Comment |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: comment1.id) |> Ash.read_one!(authorize?: false)

      # Archive post (cascades to comment2)
      :ok = Ash.destroy!(post, action: :archive, authorize?: false)
      post_archived = Post |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: post.id) |> Ash.read_one!(authorize?: false)

      # Restore post
      post_restored = post_archived |> Ash.Changeset.for_update(:restore, %{}) |> Ash.update!(authorize?: false)
      assert is_nil(post_restored.archived_at)
      assert is_nil(post_restored.archive_batch_id)

      # Fetch comments
      comment1_after = Comment |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: comment1_archived.id) |> Ash.read_one!(authorize?: false)
      comment2_after = Comment |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: comment2.id) |> Ash.read_one!(authorize?: false)

      # comment1 should remain archived (different batch)
      assert not is_nil(comment1_after.archived_at)

      # comment2 should be restored (same batch)
      assert is_nil(comment2_after.archived_at)
      assert is_nil(comment2_after.archive_batch_id)
    end
  end

  describe "purge semantics" do
    test "purging a live record fails with specific error" do
      post = Post |> Ash.Changeset.for_create(:create, %{title: "Post"}) |> Ash.create!(authorize?: false)

      assert {:error, %Ash.Error.Invalid{errors: errors}} = Ash.destroy(post, action: :purge, authorize?: false)
      assert length(errors) >= 1
      assert Enum.any?(errors, fn
        %Ash.Error.Changes.InvalidChanges{fields: [:archived_at], message: "must be archived before it can be purged"} -> true
        _ -> false
      end)
    end

    test "purging an archived record permanently removes it and descendants" do
      post = Post |> Ash.Changeset.for_create(:create, %{title: "Post"}) |> Ash.create!(authorize?: false)
      comment = Comment |> Ash.Changeset.for_create(:create, %{body: "Comment", post_id: post.id}) |> Ash.create!(authorize?: false)
      _reaction = Reaction |> Ash.Changeset.for_create(:create, %{emoji: "👍", comment_id: comment.id}) |> Ash.create!(authorize?: false)

      # Archive post
      :ok = Ash.destroy!(post, action: :archive, authorize?: false)
      post_archived = Post |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: post.id) |> Ash.read_one!(authorize?: false)

      # Purge post
      :ok = Ash.destroy!(post_archived, action: :purge, authorize?: false)

      # Verify all are gone from storage completely
      assert [] == Post |> Ash.Query.for_read(:with_archived, %{}) |> Ash.read!(authorize?: false)
      assert [] == Comment |> Ash.Query.for_read(:with_archived, %{}) |> Ash.read!(authorize?: false)
      assert [] == Reaction |> Ash.Query.for_read(:with_archived, %{}) |> Ash.read!(authorize?: false)
    end
  end

  describe "authorization" do
    test "archived read reachable only by administrator" do
      post = Post |> Ash.Changeset.for_create(:create, %{title: "Post"}) |> Ash.create!(authorize?: false)
      :ok = Ash.destroy!(post, action: :archive, authorize?: false)

      # Request as non-admin map
      assert {:error, %Ash.Error.Forbidden{}} =
               Post
               |> Ash.Query.for_read(:archived, %{})
               |> Ash.read(actor: %{role: :user}, authorize?: true)

      # Request as nil actor
      assert {:error, %Ash.Error.Forbidden{}} =
               Post
               |> Ash.Query.for_read(:archived, %{})
               |> Ash.read(actor: nil, authorize?: true)

      # Request as admin
      assert {:ok, [_]} =
               Post
               |> Ash.Query.for_read(:archived, %{})
               |> Ash.read(actor: %{role: :admin}, authorize?: true)
    end

    test "other actions permitted for everyone" do
      # Create as nil actor
      assert {:ok, post} =
               Post
               |> Ash.Changeset.for_create(:create, %{title: "Allowed"})
               |> Ash.create(actor: nil, authorize?: true)

      # Read as nil actor
      assert {:ok, [_]} =
               Post
               |> Ash.Query.for_read(:read, %{})
               |> Ash.read(actor: nil, authorize?: true)

      # Archive as nil actor
      assert :ok =
               Ash.destroy!(post, action: :archive, actor: nil, authorize?: true)

      post = Post |> Ash.Query.for_read(:with_archived, %{}) |> Ash.Query.filter(id: post.id) |> Ash.read_one!(authorize?: false)

      # Restore as nil actor
      assert {:ok, _post} =
               post
               |> Ash.Changeset.for_update(:restore, %{})
               |> Ash.update(actor: nil, authorize?: true)
    end
  end
end
