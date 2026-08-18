defmodule CatalogWeb.Router do
  use AshJsonApi.Router,
    domains: [Catalog.Library],
    prefix: "/api/json"
end
