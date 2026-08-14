defmodule Catalog.Library.Author do
  use Ash.Resource,
    domain: Catalog.Library,
    data_layer: Ash.DataLayer.Ets,
    extensions: [AshJsonApi.Resource]

  json_api do
    type "author"
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:name, :country]
    end

    update :update do
      primary? true
      accept [:name, :country]
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      public? true
      constraints [allow_empty?: false, trim?: true]
    end

    attribute :country, :string do
      public? true
      constraints [allow_empty?: false, trim?: true]
    end
  end

  relationships do
    has_many :books, Catalog.Library.Book do
      public? true
    end
  end
end
