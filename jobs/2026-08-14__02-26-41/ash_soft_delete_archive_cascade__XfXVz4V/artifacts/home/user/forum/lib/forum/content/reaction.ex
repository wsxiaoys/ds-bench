defmodule Forum.Content.Reaction do
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
    attribute :emoji, :string, allow_nil?: false, public?: true
    attribute :archived_at, :utc_datetime_usec, public?: true
    attribute :archive_batch_id, :uuid, public?: true
  end

  relationships do
    belongs_to :comment, Forum.Content.Comment, allow_nil?: false, attribute_writable?: true, public?: true
  end

  actions do
    create :create do
      accept [:emoji, :comment_id]
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
    end

    destroy :force_purge do
      require_atomic? false
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
