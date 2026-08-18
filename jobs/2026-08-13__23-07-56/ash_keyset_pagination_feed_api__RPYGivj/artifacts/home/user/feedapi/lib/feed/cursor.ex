defmodule Feed.Cursor do
  @moduledoc """
  An opaque, tamper-evident cursor codec.
  """

  @secret "feed_api_cursor_secret_key_32_bytes_long_minimum!"

  @doc """
  Encodes a map with exactly the keys `:feed`, `:direction`, and `:keyset`
  into a URL-safe Base64 string.
  """
  def encode(%{feed: feed, direction: direction, keyset: keyset} = payload)
      when is_atom(feed) and direction in [:next, :prev] and is_binary(keyset) and map_size(payload) == 3 do
    feed_str = Atom.to_string(feed)
    dir_str = Atom.to_string(direction)
    json = Jason.encode!([feed_str, dir_str, keyset])
    signature = :crypto.mac(:hmac, :sha256, @secret, json)
    Base.url_encode64(signature <> json, padding: false)
  end

  @doc """
  Decodes a cursor string back into the payload map.
  Returns `{:ok, payload}` or `{:error, :invalid_cursor}`.
  """
  def decode(encoded) when is_binary(encoded) do
    case Base.url_decode64(encoded, padding: false) do
      {:ok, <<signature::binary-size(32), json::binary>>} ->
        expected_signature = :crypto.mac(:hmac, :sha256, @secret, json)
        if signature == expected_signature do
          case Jason.decode(json) do
            {:ok, [feed_str, dir_str, keyset]} when is_binary(feed_str) and is_binary(dir_str) and is_binary(keyset) ->
              feed = String.to_existing_atom(feed_str)
              direction = String.to_existing_atom(dir_str)
              if direction in [:next, :prev] do
                {:ok, %{feed: feed, direction: direction, keyset: keyset}}
              else
                {:error, :invalid_cursor}
              end
            _ ->
              {:error, :invalid_cursor}
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
