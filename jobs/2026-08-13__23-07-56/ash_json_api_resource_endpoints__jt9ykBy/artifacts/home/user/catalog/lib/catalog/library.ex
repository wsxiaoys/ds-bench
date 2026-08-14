defmodule Catalog.Library do
  use Ash.Domain,
    extensions: [AshJsonApi.Domain]

  json_api do
    prefix "/api/json"

    routes do
      base_route "/authors", Catalog.Library.Author do
        index :read
        post :create
        get :read
        related :books, :read
        relationship :books, :read
      end

      base_route "/books", Catalog.Library.Book do
        index :read
        post :create, relationship_arguments: [{:id, :author}]
        get :read
        patch :update
        delete :destroy
      end

      base_route "/reviews", Catalog.Library.Review do
        get :read
        post :create, relationship_arguments: [{:id, :book}]
      end
    end
  end

  resources do
    resource Catalog.Library.Author
    resource Catalog.Library.Book
    resource Catalog.Library.Review
  end
end
