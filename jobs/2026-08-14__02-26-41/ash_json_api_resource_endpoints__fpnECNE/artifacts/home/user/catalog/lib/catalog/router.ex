defmodule Catalog.Router do
  use Plug.Router

  plug :match

  # Parse the actor role from the header and set it in Ash
  plug :set_actor_role

  plug :dispatch

  defp set_actor_role(conn, _opts) do
    actor =
      case Plug.Conn.get_req_header(conn, "x-actor-role") do
        ["curator" | _] -> %{role: :curator}
        _ -> %{role: :public}
      end

    Ash.PlugHelpers.set_actor(conn, actor)
  end

  forward "/api/json", to: Catalog.JsonApiRouter
end
