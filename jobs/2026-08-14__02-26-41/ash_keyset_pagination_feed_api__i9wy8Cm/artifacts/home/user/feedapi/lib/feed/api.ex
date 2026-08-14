defmodule Feed.Api do
  @moduledoc """
  The paging API layer.
  """

  alias Feed.Timeline
  alias Feed.Cursor

  @valid_feeds [:feed, :public_feed, :hot_feed, :heat_feed, :author_feed]

  @doc """
  Fetches a single window of the given feed.
  """
  @spec fetch(atom(), Keyword.t()) :: {:ok, map()} | {:error, any()}
  def fetch(feed_name, opts \\ []) do
    cond do
      feed_name not in @valid_feeds ->
        {:error, {:unknown_feed, feed_name}}

      feed_name == :author_feed and (is_nil(Keyword.get(opts, :author_id)) or not is_binary(Keyword.get(opts, :author_id))) ->
        {:error, :author_id_required}

      true ->
        action = Ash.Resource.Info.action(Feed.Timeline.Activity, feed_name)
        max_page_size = action.pagination && action.pagination.max_page_size
        limit = Keyword.get(opts, :limit)

        cond do
          not is_nil(limit) and (not is_integer(limit) or limit <= 0) ->
            {:error, :invalid_limit}

          not is_nil(limit) and not is_nil(max_page_size) and limit > max_page_size ->
            {:error, {:limit_too_large, max_page_size}}

          true ->
            # Decode cursor if present
            cursor = Keyword.get(opts, :cursor)

            case decode_cursor(cursor, feed_name) do
              {:error, reason} ->
                {:error, reason}

              {:ok, cursor_payload} ->
                # Build page_opts
                resolved_limit = limit || action.pagination.default_limit

                page_opts = [limit: resolved_limit, count: true]

                page_opts =
                  case cursor_payload do
                    nil ->
                      page_opts

                    %{direction: :next, keyset: keyset} ->
                      Keyword.put(page_opts, :after, keyset)

                    %{direction: :prev, keyset: keyset} ->
                      Keyword.put(page_opts, :before, keyset)
                  end

                # Run query
                author_id = Keyword.get(opts, :author_id)

                result =
                  if feed_name == :author_feed do
                    Timeline.author_feed(author_id, page: page_opts, load: [:author, :reaction_count, :heat])
                  else
                    apply(Timeline, feed_name, [[page: page_opts, load: [:author, :reaction_count, :heat]]])
                  end

                case result do
                  {:ok, %Ash.Page.Keyset{results: results}} ->
                    # Calculate total
                    query =
                      if feed_name == :author_feed do
                        Ash.Query.for_read(Feed.Timeline.Activity, :author_feed, %{author_id: author_id})
                      else
                        Ash.Query.for_read(Feed.Timeline.Activity, feed_name)
                      end

                    case Ash.count(query) do
                      {:ok, total} ->
                        if results == [] do
                          {:ok,
                           %{
                             items: [],
                             next_cursor: nil,
                             prev_cursor: nil,
                             total: total,
                             has_next: false,
                             has_prev: false
                           }}
                        else
                          first_item = List.first(results)
                          last_item = List.last(results)

                          # Check has_prev
                          prev_check_opts = [limit: 1, before: first_item.__metadata__.keyset]

                          has_prev =
                            case run_check_query(feed_name, author_id, prev_check_opts) do
                              {:ok, %Ash.Page.Keyset{results: [_ | _]}} -> true
                              _ -> false
                            end

                          # Check has_next
                          next_check_opts = [limit: 1, after: last_item.__metadata__.keyset]

                          has_next =
                            case run_check_query(feed_name, author_id, next_check_opts) do
                              {:ok, %Ash.Page.Keyset{results: [_ | _]}} -> true
                              _ -> false
                            end

                          next_cursor =
                            if has_next do
                              Cursor.encode(%{
                                feed: feed_name,
                                direction: :next,
                                keyset: last_item.__metadata__.keyset
                              })
                            else
                              nil
                            end

                          prev_cursor =
                            if has_prev do
                              Cursor.encode(%{
                                feed: feed_name,
                                direction: :prev,
                                keyset: first_item.__metadata__.keyset
                              })
                            else
                              nil
                            end

                          {:ok,
                           %{
                             items: results,
                             next_cursor: next_cursor,
                             prev_cursor: prev_cursor,
                             total: total,
                             has_next: has_next,
                             has_prev: has_prev
                           }}
                        end

                      {:error, err} ->
                        {:error, err}
                    end

                  {:error, err} ->
                    {:error, err}
                end
            end
        end
    end
  end

  defp decode_cursor(nil, _feed_name), do: {:ok, nil}

  defp decode_cursor(cursor, feed_name) do
    case Cursor.decode(cursor) do
      {:ok, %{feed: ^feed_name} = payload} ->
        {:ok, payload}

      {:ok, _} ->
        {:error, :cursor_feed_mismatch}

      {:error, :invalid_cursor} ->
        {:error, :invalid_cursor}
    end
  end

  defp run_check_query(feed_name, author_id, page_opts) do
    if feed_name == :author_feed do
      Timeline.author_feed(author_id, page: page_opts)
    else
      apply(Timeline, feed_name, [[page: page_opts]])
    end
  end

  @doc """
  Drives infinite scroll forwards.
  """
  @spec walk(atom(), Keyword.t()) :: {:ok, map()} | {:error, any()}
  def walk(feed_name, opts \\ []) do
    case fetch(feed_name, opts) do
      {:ok, %{items: [], total: total}} ->
        {:ok, %{pages: [[]], total: total}}

      {:ok, first_page} ->
        collect_forward(feed_name, opts, first_page, [Enum.map(first_page.items, & &1.id)])

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp collect_forward(_feed_name, _opts, %{next_cursor: nil, total: total}, acc) do
    {:ok, %{pages: Enum.reverse(acc), total: total}}
  end

  defp collect_forward(feed_name, opts, %{next_cursor: next_cursor}, acc) do
    next_opts = Keyword.put(opts, :cursor, next_cursor)

    case fetch(feed_name, next_opts) do
      {:ok, page} ->
        collect_forward(feed_name, opts, page, [Enum.map(page.items, & &1.id) | acc])

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Drives infinite scroll backwards.
  """
  @spec walk_back(atom(), Keyword.t()) :: {:ok, map()} | {:error, any()}
  def walk_back(feed_name, opts \\ []) do
    case fetch(feed_name, opts) do
      {:ok, %{items: [], total: total}} ->
        {:ok, %{pages: [[]], total: total}}

      {:ok, first_page} ->
        case find_last_page(feed_name, opts, first_page) do
          {:ok, last_page} ->
            collect_backward(feed_name, opts, last_page, [Enum.map(last_page.items, & &1.id)], first_page.total)

          {:error, reason} ->
            {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp find_last_page(_feed_name, _opts, %{next_cursor: nil} = page), do: {:ok, page}

  defp find_last_page(feed_name, opts, %{next_cursor: next_cursor}) do
    next_opts = Keyword.put(opts, :cursor, next_cursor)

    case fetch(feed_name, next_opts) do
      {:ok, page} ->
        find_last_page(feed_name, opts, page)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp collect_backward(_feed_name, _opts, %{prev_cursor: nil}, acc, total) do
    {:ok, %{pages: Enum.reverse(acc), total: total}}
  end

  defp collect_backward(feed_name, opts, %{prev_cursor: prev_cursor}, acc, total) do
    prev_opts = Keyword.put(opts, :cursor, prev_cursor)

    case fetch(feed_name, prev_opts) do
      {:ok, page} ->
        collect_backward(feed_name, opts, page, [Enum.map(page.items, & &1.id) | acc], total)

      {:error, reason} ->
        {:error, reason}
    end
  end
end
