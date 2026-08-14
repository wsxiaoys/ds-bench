defmodule Forum.Content.Comment do
  use Ash.Resource,
    domain: Forum.Content,
    data_layer: Ash.DataLayer.Ets,
    authorizers: [Ash.Policy.Authorizer],
    primary_read_warning?: false

  ets do
    private? true
  end

  attributes do
    uuid_primary_key :id, public?: true

    attribute :body, :string do
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

    attribute :post_id, :uuid do
      public? true
      allow_nil? false
      writable? true
    end
  end

  relationships do
    belongs_to :post, Forum.Content.Post do
      public? true
      define_attribute? false
      read_action :read
    end

    has_many :reactions, Forum.Content.Reaction do
      public? true
      read_action :read
    end
  end

  aggregates do
    count :reaction_count, :reactions do
      public? true
    end
  end

  actions do
    create :create do
      accept [:body, :post_id]
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
      change Forum.Archive.Changes.CascadePurge
    end
  end

  policies do
    policy action(:archived) do
      authorize_if actor_attribute_equals(:role, :admin)
    end

    policy action([:create, :read, :with_archived, :archive, :restore, :purge]) do
      authorize_if always()
    end
  end
end
