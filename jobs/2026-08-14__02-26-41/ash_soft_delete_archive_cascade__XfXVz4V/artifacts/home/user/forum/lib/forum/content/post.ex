defmodule Forum.Content.Post do
  use Ash.Resource,
    domain: Forum.Content,
    data_layer: Ash.DataLayer.Ets,
    authorizers: [Ash.Policy.Authorizer],
    primary_read_warning?: false

  require Ash.Query

  ets do
    private? true
  end

  attributes do
    uuid_primary_key :id, public?: true
    attribute :title, :string, allow_nil?: false, public?: true
    attribute :archived_at, :utc_datetime_usec, public?: true
    attribute :archive_batch_id, :uuid, public?: true
  end

  relationships do
    has_many :comments, Forum.Content.Comment, public?: true
  end

  aggregates do
    count :comment_count, :comments, public?: true
  end

  actions do
    create :create do
      accept [:title]
    end

    read :read do
      primary? true
      prepare Forum.Archive.Preparations.ArchiveScope
    end

    read :archived do
      prepare Forum.Archive.Preparations.ArchiveScope
    end

    read :with_archived do
      prepare Forum.Archive.Preparations.ArchiveScope
    end

    destroy :archive do
      soft? true
      require_atomic? false
      change Forum.Archive.Changes.CascadeArchive
    end

    update :restore do
      require_atomic? false
      change Forum.Archive.Changes.CascadeRestore
    end

    destroy :purge do
      require_atomic? false

      validate fn changeset, _context ->
        if is_nil(changeset.data.archived_at) do
          {:error, Ash.Error.Changes.InvalidChanges.exception(
            fields: [:archived_at],
            message: "must be archived before it can be purged"
          )}
        else
          :ok
        end
      end

      change fn changeset, _context ->
        Ash.Changeset.after_action(changeset, fn _changeset, record ->
          comments =
            Forum.Content.Comment
            |> Ash.Query.for_read(:with_archived, %{})
            |> Ash.Query.filter(post_id == ^record.id)
            |> Ash.read!(authorize?: false)

          Enum.each(comments, fn comment ->
            comment
            |> Ash.Changeset.for_destroy(:force_purge, %{})
            |> Ash.destroy!(authorize?: false)
          end)

          {:ok, record}
        end)
      end
    end

    destroy :force_purge do
      require_atomic? false

      change fn changeset, _context ->
        Ash.Changeset.after_action(changeset, fn _changeset, record ->
          comments =
            Forum.Content.Comment
            |> Ash.Query.for_read(:with_archived, %{})
            |> Ash.Query.filter(post_id == ^record.id)
            |> Ash.read!(authorize?: false)

          Enum.each(comments, fn comment ->
            comment
            |> Ash.Changeset.for_destroy(:force_purge, %{})
            |> Ash.destroy!(authorize?: false)
          end)

          {:ok, record}
        end)
      end
    end
  end

  policies do
    policy action(:archived) do
      authorize_if actor_attribute_equals(:role, :admin)
    end

    policy always() do
      authorize_if always()
    end
  end
end
