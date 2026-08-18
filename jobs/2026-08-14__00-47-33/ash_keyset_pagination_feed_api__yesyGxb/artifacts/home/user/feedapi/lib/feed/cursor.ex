defmodule Feed.Cursor do
  @moduledoc """
  An opaque, tamper-evident cursor codec.
  """

  @secret "stable_feed_cursor_secret_key_1234567890_abc"

  @doc """
  Encodes a map with exactly the keys `:feed`, `:direction`, and `:keyset`
  into a URL-safe Base64 string.
  """
  @spec encode(map()) :: String.t()
  def encode(%{feed: feed, direction: direction, keyset: keyset} = payload)
      when is_atom(feed) and direction in [:next, :prev] and is_binary(keyset) and map_size(payload) == 3 do
    # Serialize the fields in a deterministic list structure
    term = [feed, direction, keyset]
    binary_payload = :erlang.term_to_binary(term)
    signature = :crypto.mac(:hmac, :sha256, @secret, binary_payload)
    Base.url_encode64(signature <> binary_payload, padding: false)
  end

  @doc """
  Decodes a binary cursor string back into the payload map.
  Returns `{:ok, payload}` or `{:error, :invalid_cursor}`.
  """
  @spec decode(any()) :: {:ok, map()} | {:error, :invalid_cursor}
  def decode(cursor) when is_binary(cursor) do
    case Base.url_decode64(cursor, padding: false) do
      {:ok, <<signature::binary-size(32), binary_payload::binary>>} ->
        expected_signature = :crypto.mac(:hmac, :sha256, @secret, binary_payload)

        if signature == expected_signature do
          try do
            case :erlang.binary_to_term(binary_payload) do
              [feed, direction, keyset] when is_atom(feed) and direction in [:next, :prev] and is_binary(keyset) ->
                {:ok, %{feed: feed, direction: direction, keyset: keyset}}

              _ ->
                {:error, :invalid_cursor}
            end
          rescue
            _ -> {:error, :invalid_cursor}
          catch
            _ -> {:error, :invalid_cursor}
          end
        else
          {:error, :invalid_cursor}
        end

      _ ->
        {:error, :invalid_cursor}
    end
  end

  def decode(_), do: {:error, :invalid_cursor}
end
