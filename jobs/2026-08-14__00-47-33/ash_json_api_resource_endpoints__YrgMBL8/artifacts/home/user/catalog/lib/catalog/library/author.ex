defmodule Catalog.Library.Author do
  use Ash.Resource,
    otp_app: :catalog,
    domain: Catalog.Library,
    data_layer: Ash.DataLayer.Ets,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource]

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      public? true
    end

    attribute :country, :string do
      allow_nil? true
      public? true
    end
  end

  relationships do
    has_many :books, Catalog.Library.Book do
      public? true
    end
  end

  actions do
    read :read do
      primary? true
    end

    create :create do
      primary? true
      accept [:name, :country]
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  json_api do
    type "author"

    includes [
      books: [
        :reviews
      ]
    ]

    routes do
      base "/authors"

      get :read, primary?: true
      index :read
      post :create

      related :books, :read, primary?: true
      relationship :books, :read, primary?: true
    end
  end

  validations do
    validate string_length(:name, min: 1)
  end
end
