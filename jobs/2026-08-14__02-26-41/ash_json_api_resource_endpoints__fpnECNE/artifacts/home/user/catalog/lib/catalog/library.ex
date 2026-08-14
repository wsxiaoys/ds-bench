defmodule Catalog.Library do
  use Ash.Domain, extensions: [AshJsonApi.Domain]

  resources do
    resource Catalog.Library.Author
    resource Catalog.Library.Book
    resource Catalog.Library.Review
  end

  json_api do
    routes do
      base_route "/authors", Catalog.Library.Author do
        index :read
        post :create
        get :read, primary?: true
        related :books, :read, primary?: true
        relationship :books, :read, primary?: true
      end

      base_route "/books", Catalog.Library.Book do
        index :read
        post :create, relationship_arguments: [{:id, :author}]
        get :read, primary?: true
        patch :update
        delete :destroy
      end

      base_route "/reviews", Catalog.Library.Review do
        get :read, primary?: true
        post :create, relationship_arguments: [{:id, :book}]
      end

      route Catalog.Library.Book, :get, "/reports/shelf_summary", :shelf_summary, wrap_in_result?: true
    end
  end
end
