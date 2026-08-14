defmodule Catalog.Router do
  use Plug.Router

  plug Plug.Logger

  # Parse JSON bodies with the correct JSON:API mime type
  plug Plug.Parsers,
    parsers: [:json],
    pass: ["application/vnd.api+json", "application/json"],
    json_decoder: Jason

  # Fetch query params
  plug :fetch_query_params

  # Set the actor based on x-actor-role header
  plug :set_actor_plug

  plug :match
  plug :dispatch

  # Non-CRUD report route
  get "/api/json/reports/shelf_summary" do
    case conn.query_params["shelf"] do
      nil ->
        error_id = Ash.UUID.generate()
        error_response = %{
          "errors" => [
            %{
              "id" => error_id,
              "status" => "400",
              "code" => "required",
              "title" => "Required Parameter Missing",
              "detail" => "The query parameter 'shelf' is required.",
              "source" => %{
                "parameter" => "shelf"
              }
            }
          ]
        }

        conn
        |> put_resp_header("content-type", "application/vnd.api+json")
        |> send_resp(400, Jason.encode!(error_response))

      shelf ->
        require Ash.Query

        books =
          Catalog.Library.Book
          |> Ash.Query.filter(shelf == ^shelf)
          |> Ash.Query.load([:reviews])
          |> Ash.read!()

        book_count = length(books)
        review_count = Enum.reduce(books, 0, fn book, acc -> acc + length(book.reviews) end)
        total_price_cents = Enum.reduce(books, 0, fn book, acc -> acc + book.price_cents end)

        response = %{
          "result" => %{
            "shelf" => shelf,
            "book_count" => book_count,
            "review_count" => review_count,
            "total_price_cents" => total_price_cents
          }
        }

        conn
        |> put_resp_header("content-type", "application/vnd.api+json")
        |> send_resp(200, Jason.encode!(response))
    end
  end

  # Forward everything else under /api/json to the AshJsonApi router
  forward "/api/json", to: Catalog.JsonApiRouter

  # Fallback match for other routes
  match _ do
    send_resp(conn, 404, "Not Found")
  end

  defp set_actor_plug(conn, _opts) do
    actor =
      case Plug.Conn.get_req_header(conn, "x-actor-role") do
        ["curator"] -> %{role: "curator"}
        [role] -> %{role: role}
        _ -> %{role: "visitor"}
      end

    Ash.PlugHelpers.set_actor(conn, actor)
  end
end
