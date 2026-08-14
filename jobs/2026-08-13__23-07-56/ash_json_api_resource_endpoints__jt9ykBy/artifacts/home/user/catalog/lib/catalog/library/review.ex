defmodule Catalog.Library.Review do
  use Ash.Resource,
    domain: Catalog.Library,
    data_layer: Ash.DataLayer.Ets,
    extensions: [AshJsonApi.Resource]

  json_api do
    type "review"
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:rating, :body]
      argument :book, :uuid, allow_nil?: false
      change manage_relationship(:book, type: :append_and_remove)
    end

    update :update do
      primary? true
      accept [:rating, :body]
    end
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
      constraints [allow_empty?: false, trim?: true]
    end
  end

  relationships do
    belongs_to :book, Catalog.Library.Book do
      allow_nil? false
      public? true
    end
  end
end
