defmodule Forum.Content.Reaction do
  use Ash.Resource,
    domain: Forum.Content,
    data_layer: Ash.DataLayer.Ets,
    authorizers: [Ash.Policy.Authorizer]

  require Ash.Query

  ets do
    private? true
  end

  attributes do
    uuid_primary_key :id do
      public? true
    end

    attribute :emoji, :string do
      public? true
      allow_nil? false
    end

    attribute :archived_at, :utc_datetime_usec do
      public? true
      allow_nil? true
    end

    attribute :archive_batch_id, :uuid do
      public? true
      allow_nil? true
    end
  end

  relationships do
    belongs_to :comment, Forum.Content.Comment do
      allow_nil? false
      attribute_writable? true
      attribute_public? true
      public? true
    end
  end

  preparations do
    prepare Forum.Archive.Preparations.ArchiveScope
  end

  actions do
    create :create do
      accept [:emoji, :comment_id]
    end

    read :read do
      primary? true
    end

    read :archived
    read :with_archived

    destroy :archive do
      soft? true
      require_atomic? false

      argument :archived_at, :utc_datetime_usec
      argument :archive_batch_id, :uuid

      change Forum.Archive.Changes.CascadeArchive
    end

    update :restore do
      require_atomic? false
      change Forum.Archive.Changes.CascadeRestore
    end

    destroy :purge do
      require_atomic? false
      validate Forum.Archive.Validations.MustBeArchived
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
