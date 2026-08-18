defmodule Catalog.Library.Review do
  use Ash.Resource,
    otp_app: :catalog,
    domain: Catalog.Library,
    data_layer: Ash.DataLayer.Ets,
    extensions: [AshJsonApi.Resource],
    authorizers: [Ash.Policy.Authorizer]

  json_api do
    type "review"
    includes [:book]
  end

  attributes do
    uuid_primary_key :id

    attribute :rating, :integer do
      allow_nil? false
      public? true
      constraints [min: 1, max: 5]
    end

    attribute :body, :string do
      public? true
    end
  end

  relationships do
    belongs_to :book, Catalog.Library.Book do
      allow_nil? false
      public? true
      attribute_public? false
      attribute_writable? true
    end
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:rating, :body]
      argument :book, :uuid, allow_nil?: false
      change manage_relationship(:book, :book, type: :append_and_remove)
    end

    update :update do
      accept [:rating, :body]
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end
end
