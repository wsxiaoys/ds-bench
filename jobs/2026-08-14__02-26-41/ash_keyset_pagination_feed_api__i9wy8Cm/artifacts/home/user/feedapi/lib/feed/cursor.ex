defmodule Feed.Cursor do
  @moduledoc """
  An opaque, tamper-evident cursor codec for pagination.
  """

  @secret "feedapi_secret_key_for_cursor_signing_2026"

  @doc """
  Encodes a map with exactly `:feed`, `:direction` and `:keyset` into a URL-safe Base64 string.
  """
  @spec encode(map()) :: String.t()
  def encode(%{feed: feed, direction: direction, keyset: keyset} = map)
      when map_size(map) == 3 and is_atom(feed) and direction in [:next, :prev] and is_binary(keyset) do
    binary = :erlang.term_to_binary(map)
    signature = :crypto.mac(:hmac, :sha256, @secret, binary)
    full_binary = <<signature::binary-size(32), binary::binary>>
    Base.url_encode64(full_binary, padding: false)
  end

  @doc """
  Decodes a cursor string back into the map payload.
  Returns `{:ok, payload}` or `{:error, :invalid_cursor}`.
  """
  @spec decode(binary()) :: {:ok, map()} | {:error, :invalid_cursor}
  def decode(cursor) when is_binary(cursor) do
    case Base.url_decode64(cursor, padding: false) do
      {:ok, <<signature::binary-size(32), binary::binary>>} ->
        expected_signature = :crypto.mac(:hmac, :sha256, @secret, binary)
        if signature == expected_signature do
          # Safely convert binary to term
          try do
            case :erlang.binary_to_term(binary, [:safe]) do
              %{feed: feed, direction: direction, keyset: keyset} = map
              when map_size(map) == 3 and is_atom(feed) and direction in [:next, :prev] and is_binary(keyset) ->
                {:ok, %{feed: feed, direction: direction, keyset: keyset}}

              _ ->
                {:error, :invalid_cursor}
            end
          rescue
            _ -> {:error, :invalid_cursor}
          end
        else
          {:error, :invalid_cursor}
        end

      _ ->
        {:error, :invalid_cursor}
    end
  rescue
    _ -> {:error, :invalid_cursor}
  end

  def decode(_), do: {:error, :invalid_cursor}
end
