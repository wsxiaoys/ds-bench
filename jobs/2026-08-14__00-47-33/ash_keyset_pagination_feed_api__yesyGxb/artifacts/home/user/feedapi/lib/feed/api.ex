defmodule Feed.Api do
  @moduledoc """
  Paging API layer for the activity feed.
  """

  @allowed_feeds [:feed, :public_feed, :hot_feed, :heat_feed, :author_feed]

  @doc """
  Fetches a window of activities for the given feed name.
  """
  @spec fetch(atom(), Keyword.t()) :: {:ok, map()} | {:error, any()}
  def fetch(feed_name, opts \\ []) do
    cond do
      feed_name not in @allowed_feeds ->
        {:error, {:unknown_feed, feed_name}}

      feed_name == :author_feed and is_nil(opts[:author_id]) ->
        {:error, :author_id_required}

      true ->
        action = Ash.Resource.Info.action(Feed.Timeline.Activity, feed_name)
        max_page_size = action.pagination && action.pagination.max_page_size

        case validate_limit(opts[:limit], max_page_size) do
          {:error, reason} ->
            {:error, reason}

          {:ok, limit} ->
            case decode_cursor_opt(opts[:cursor], feed_name) do
              {:error, reason} ->
                {:error, reason}

              {:ok, cursor_info} ->
                execute_fetch(feed_name, cursor_info, limit, opts)
            end
        end
    end
  end

  @doc """
  Drives infinite scroll forwards.
  """
  @spec walk(atom(), Keyword.t()) :: {:ok, map()} | {:error, any()}
  def walk(feed_name, opts \\ []) do
    case fetch(feed_name, opts) do
      {:error, reason} ->
        {:error, reason}

      {:ok, %{items: [], total: total}} ->
        {:ok, %{pages: [[]], total: total}}

      {:ok, first_page} ->
        ids = Enum.map(first_page.items, & &1.id)
        do_walk(feed_name, opts, first_page.next_cursor, [ids], first_page.total)
    end
  end

  defp do_walk(_feed_name, _opts, nil, pages_acc, total) do
    {:ok, %{pages: Enum.reverse(pages_acc), total: total}}
  end

  defp do_walk(feed_name, opts, next_cursor, pages_acc, total) do
    new_opts = Keyword.put(opts, :cursor, next_cursor)

    case fetch(feed_name, new_opts) do
      {:error, reason} ->
        {:error, reason}

      {:ok, page} ->
        ids = Enum.map(page.items, & &1.id)
        do_walk(feed_name, opts, page.next_cursor, [ids | pages_acc], total)
    end
  end

  @doc """
  Drives infinite scroll backwards.
  """
  @spec walk_back(atom(), Keyword.t()) :: {:ok, map()} | {:error, any()}
  def walk_back(feed_name, opts \\ []) do
    case fetch(feed_name, opts) do
      {:error, reason} ->
        {:error, reason}

      {:ok, %{items: [], total: total}} ->
        {:ok, %{pages: [[]], total: total}}

      {:ok, first_page} ->
        case find_last_page(feed_name, opts, first_page) do
          {:error, reason} ->
            {:error, reason}

          {last_page_items, last_page_prev_cursor, total} ->
            do_walk_back(feed_name, opts, last_page_prev_cursor, [last_page_items], total)
        end
    end
  end

  defp find_last_page(feed_name, opts, page) do
    if page.next_cursor do
      new_opts = Keyword.put(opts, :cursor, page.next_cursor)
      case fetch(feed_name, new_opts) do
        {:error, reason} -> {:error, reason}
        {:ok, next_page} -> find_last_page(feed_name, opts, next_page)
      end
    else
      ids = Enum.map(page.items, & &1.id)
      {ids, page.prev_cursor, page.total}
    end
  end

  defp do_walk_back(_feed_name, _opts, nil, pages_acc, total) do
    {:ok, %{pages: Enum.reverse(pages_acc), total: total}}
  end

  defp do_walk_back(feed_name, opts, prev_cursor, pages_acc, total) do
    new_opts = Keyword.put(opts, :cursor, prev_cursor)
    case fetch(feed_name, new_opts) do
      {:error, reason} ->
        {:error, reason}

      {:ok, page} ->
        ids = Enum.map(page.items, & &1.id)
        do_walk_back(feed_name, opts, page.prev_cursor, [ids | pages_acc], total)
    end
  end

  # Helpers

  defp validate_limit(nil, _max_page_size), do: {:ok, nil}
  defp validate_limit(limit, max_page_size) do
    if not is_integer(limit) or limit <= 0 do
      {:error, :invalid_limit}
    else
      if max_page_size && limit > max_page_size do
        {:error, {:limit_too_large, max_page_size}}
      else
        {:ok, limit}
      end
    end
  end

  defp decode_cursor_opt(nil, _feed_name), do: {:ok, nil}
  defp decode_cursor_opt(cursor, feed_name) do
    case Feed.Cursor.decode(cursor) do
      {:error, :invalid_cursor} ->
        {:error, :invalid_cursor}

      {:ok, %{feed: decoded_feed} = decoded_payload} ->
        if decoded_feed != feed_name do
          {:error, :cursor_feed_mismatch}
        else
          {:ok, decoded_payload}
        end
    end
  end

  defp execute_fetch(feed_name, cursor_info, limit, opts) do
    page_opts = [count: true]
    page_opts = if limit, do: Keyword.put(page_opts, :limit, limit), else: page_opts

    page_opts =
      case cursor_info do
        nil ->
          page_opts

        %{direction: :next, keyset: keyset} ->
          Keyword.put(page_opts, :after, keyset)

        %{direction: :prev, keyset: keyset} ->
          Keyword.put(page_opts, :before, keyset)
      end

    load_opts = [load: [:author, :reaction_count, :heat]]

    result =
      if feed_name == :author_feed do
        author_id = opts[:author_id]
        Feed.Timeline.author_feed(author_id, [page: page_opts] ++ load_opts)
      else
        apply(Feed.Timeline, feed_name, [[page: page_opts] ++ load_opts])
      end

    case result do
      {:error, %Ash.Error.Invalid{} = err} ->
        {:error, err}

      {:error, other_err} ->
        {:error, other_err}

      {:ok, page} ->
        items = page.results
        {has_next, has_prev} = calculate_has_next_prev(feed_name, items, opts)

        next_cursor =
          if has_next and not Enum.empty?(items) do
            last_keyset = List.last(items).__metadata__.keyset
            Feed.Cursor.encode(%{feed: feed_name, direction: :next, keyset: last_keyset})
          else
            nil
          end

        prev_cursor =
          if has_prev and not Enum.empty?(items) do
            first_keyset = List.first(items).__metadata__.keyset
            Feed.Cursor.encode(%{feed: feed_name, direction: :prev, keyset: first_keyset})
          else
            nil
          end

        {:ok,
         %{
           items: items,
           next_cursor: next_cursor,
           prev_cursor: prev_cursor,
           total: page.count || 0,
           has_next: has_next,
           has_prev: has_prev
         }}
    end
  end

  defp calculate_has_next_prev(_feed_name, [], _opts), do: {false, false}
  defp calculate_has_next_prev(feed_name, items, opts) do
    first_keyset = List.first(items).__metadata__.keyset
    last_keyset = List.last(items).__metadata__.keyset

    has_prev =
      case check_existence(feed_name, [before: first_keyset, limit: 1], opts) do
        {:ok, true} -> true
        _ -> false
      end

    has_next =
      case check_existence(feed_name, [after: last_keyset, limit: 1], opts) do
        {:ok, true} -> true
        _ -> false
      end

    {has_next, has_prev}
  end

  defp check_existence(feed_name, page_opts, opts) do
    result =
      if feed_name == :author_feed do
        author_id = opts[:author_id]
        Feed.Timeline.author_feed(author_id, page: page_opts)
      else
        apply(Feed.Timeline, feed_name, [[page: page_opts]])
      end

    case result do
      {:ok, page} -> {:ok, not Enum.empty?(page.results)}
      error -> error
    end
  end
end
