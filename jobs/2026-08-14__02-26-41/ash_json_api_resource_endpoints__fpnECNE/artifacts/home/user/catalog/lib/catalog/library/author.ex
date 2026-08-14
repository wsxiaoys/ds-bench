defmodule Catalog.Library.Author do
  use Ash.Resource,
    otp_app: :catalog,
    domain: Catalog.Library,
    data_layer: Ash.DataLayer.Ets,
    extensions: [AshJsonApi.Resource],
    authorizers: [Ash.Policy.Authorizer]

  json_api do
    type "author"
    includes [books: [:reviews]]
  end

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      public? true
      constraints [min_length: 1]
    end

    attribute :country, :string do
      public? true
    end
  end

  relationships do
    has_many :books, Catalog.Library.Book do
      public? true
    end
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:name, :country]
    end

    update :update do
      accept [:name, :country]
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end
end
