defmodule Catalog.Library.Review do
  use Ash.Resource,
    otp_app: :catalog,
    domain: Catalog.Library,
    data_layer: Ash.DataLayer.Ets,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource]

  attributes do
    uuid_primary_key :id

    attribute :rating, :integer do
      allow_nil? false
      public? true
    end

    attribute :body, :string do
      allow_nil? true
      public? true
    end
  end

  relationships do
    belongs_to :book, Catalog.Library.Book do
      allow_nil? false
      public? true
      attribute_public? false
    end
  end

  actions do
    read :read do
      primary? true
    end

    create :create do
      primary? true
      accept [:rating, :body]
      argument :book, :map, allow_nil?: false
      change manage_relationship(:book, :book, type: :append_and_remove)
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  json_api do
    type "review"

    includes [
      :book
    ]

    routes do
      base "/reviews"

      get :read, primary?: true
      post :create, relationship_arguments: [:book]
    end
  end

  validations do
    validate numericality(:rating, greater_than_or_equal_to: 1, less_than_or_equal_to: 5)
  end
end
