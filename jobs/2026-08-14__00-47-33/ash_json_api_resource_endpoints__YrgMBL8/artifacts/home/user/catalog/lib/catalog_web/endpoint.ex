defmodule CatalogWeb.Endpoint do
  use Plug.Router

  plug :match

  # Parse query parameters
  plug :fetch_query_params

  # Custom plug to fix doubled URLs in JSON:API responses
  plug :fix_doubled_urls

  # Custom plug to set the actor
  plug :set_actor

  plug :dispatch

  defp fix_doubled_urls(conn, _opts) do
    register_before_send(conn, fn conn ->
      case get_resp_header(conn, "content-type") do
        ["application/vnd.api+json" <> _] ->
          body = conn.resp_body
          fixed_body =
            body
            |> String.replace("http://127.0.0.1:4001/api/json/http:/127.0.0.1:4001/api/json/", "http://127.0.0.1:4001/api/json/")
            |> String.replace("http://127.0.0.1:4001/api/json/http://127.0.0.1:4001/api/json/", "http://127.0.0.1:4001/api/json/")

          %{conn | resp_body: fixed_body}

        _ ->
          conn
      end
    end)
  end

  defp set_actor(conn, _opts) do
    case Plug.Conn.get_req_header(conn, "x-actor-role") do
      [role] when role != "" ->
        Ash.PlugHelpers.set_actor(conn, %{role: role})
      _ ->
        Ash.PlugHelpers.set_actor(conn, %{role: nil})
    end
  end

  get "/api/json/reports/shelf_summary" do
    case conn.query_params["shelf"] do
      nil ->
        error_resp = %{
          errors: [
            %{
              id: Ash.UUID.generate(),
              status: "400",
              code: "required",
              title: "Required parameter missing",
              detail: "The query parameter 'shelf' is required.",
              source: %{
                parameter: "shelf"
              }
            }
          ]
        }

        conn
        |> put_resp_header("content-type", "application/vnd.api+json")
        |> send_resp(400, Jason.encode!(error_resp))

      shelf ->
        summary = get_shelf_summary(shelf)

        conn
        |> put_resp_header("content-type", "application/vnd.api+json")
        |> send_resp(200, Jason.encode!(%{result: summary}))
    end
  end

  # Forward everything else under /api/json to CatalogWeb.Router
  forward "/api/json", to: CatalogWeb.Router

  match _ do
    conn
    |> put_resp_header("content-type", "application/vnd.api+json")
    |> send_resp(404, Jason.encode!(%{
      errors: [
        %{
          id: Ash.UUID.generate(),
          status: "404",
          code: "not_found",
          title: "Not Found",
          detail: "Route not found"
        }
      ]
    }))
  end

  defp get_shelf_summary(shelf) do
    require Ash.Query

    books =
      Catalog.Library.Book
      |> Ash.Query.filter(shelf == ^shelf)
      |> Ash.Query.load(:reviews)
      |> Ash.read!(authorize?: false)

    book_count = length(books)
    total_price_cents = Enum.reduce(books, 0, fn book, acc -> acc + book.price_cents end)
    review_count = Enum.reduce(books, 0, fn book, acc -> acc + length(book.reviews) end)

    %{
      shelf: shelf,
      book_count: book_count,
      review_count: review_count,
      total_price_cents: total_price_cents
    }
  end
end
