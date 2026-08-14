defmodule Catalog.Library.Book do
  use Ash.Resource,
    otp_app: :catalog,
    domain: Catalog.Library,
    data_layer: Ash.DataLayer.Ets,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource]

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      public? true
    end

    attribute :shelf, :string do
      allow_nil? false
      public? true
    end

    attribute :year, :integer do
      allow_nil? false
      public? true
    end

    attribute :price_cents, :integer do
      allow_nil? false
      public? true
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
      attribute_public? false
    end

    has_many :reviews, Catalog.Library.Review do
      public? true
    end
  end

  actions do
    read :read do
      primary? true
      pagination do
        required? false
        offset? true
        keyset? false
        countable :by_default
      end
    end

    create :create do
      primary? true
      accept [:title, :shelf, :year, :price_cents, :restricted]
      argument :author, :map, allow_nil?: false
      change manage_relationship(:author, :author, type: :append_and_remove)
    end

    update :update do
      primary? true
      accept [:title, :shelf, :year, :price_cents, :restricted]
    end

    destroy :destroy do
      primary? true
    end
  end

  policies do
    policy action_type(:destroy) do
      authorize_if actor_attribute_equals(:role, "curator")
    end

    policy action_type(:read) do
      authorize_if actor_attribute_equals(:role, "curator")
      authorize_if expr(restricted == false)
    end

    policy action_type([:create, :update]) do
      authorize_if always()
    end
  end

  json_api do
    type "book"

    includes [
      :author,
      :reviews
    ]

    routes do
      base "/books"

      get :read, primary?: true
      index :read
      post :create, relationship_arguments: [:author]
      patch :update
      delete :destroy
    end
  end

  validations do
    validate string_length(:title, min: 1)
    validate string_length(:shelf, min: 1)
    validate numericality(:year, greater_than_or_equal_to: 1450, less_than_or_equal_to: 2100)
    validate numericality(:price_cents, greater_than_or_equal_to: 0)
  end
end
