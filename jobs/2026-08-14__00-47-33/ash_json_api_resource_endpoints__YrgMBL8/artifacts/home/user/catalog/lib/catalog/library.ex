defmodule Catalog.Library do
  use Ash.Domain,
    otp_app: :catalog,
    extensions: [AshJsonApi.Domain]

  resources do
    resource Catalog.Library.Author
    resource Catalog.Library.Book
    resource Catalog.Library.Review
  end

  json_api do
    prefix "/api/json"
  end
end
