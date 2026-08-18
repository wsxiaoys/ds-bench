defmodule Catalog.Library.Book do
  use Ash.Resource,
    domain: Catalog.Library,
    data_layer: Ash.DataLayer.Ets,
    extensions: [AshJsonApi.Resource],
    authorizers: [Ash.Policy.Authorizer]

  json_api do
    type "book"
  end

  policies do
    # If the actor is a curator, they can do everything
    bypass actor_attribute_equals(:role, "curator") do
      authorize_if always()
    end

    # For read action for non-curators:
    policy action_type(:read) do
      authorize_if expr(restricted == false)
    end

    # For create and update actions for non-curators:
    policy action_type([:create, :update]) do
      authorize_if always()
    end

    # For destroy action for non-curators:
    policy action_type(:destroy) do
      forbid_if always()
    end
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:title, :shelf, :year, :price_cents, :restricted]
      argument :author, :uuid, allow_nil?: false
      change manage_relationship(:author, type: :append_and_remove)
    end

    update :update do
      primary? true
      accept [:title, :shelf, :year, :price_cents, :restricted]
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      public? true
      constraints [allow_empty?: false, trim?: true]
    end

    attribute :shelf, :string do
      allow_nil? false
      public? true
      constraints [allow_empty?: false, trim?: true]
    end

    attribute :year, :integer do
      allow_nil? false
      public? true
      constraints [min: 1450, max: 2100]
    end

    attribute :price_cents, :integer do
      allow_nil? false
      public? true
      constraints [min: 0]
    end

    attribute :restricted, :boolean do
      allow_nil? false
      default false
      public? true
    end
  end

  relationships do
    belongs_to :author, Catalog.Library.Author do
      allow_nil? false
      public? true
    end

    has_many :reviews, Catalog.Library.Review do
      public? true
    end
  end
end
