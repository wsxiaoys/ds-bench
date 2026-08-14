defmodule Feed.Api do
  @moduledoc """
  The paging API layer.
  """

  @valid_feeds [:feed, :public_feed, :hot_feed, :heat_feed, :author_feed]

  @doc """
  Fetches a window of activities for the given feed.
  """
  def fetch(feed_name, opts \\ []) do
    cond do
      feed_name not in @valid_feeds ->
        {:error, {:unknown_feed, feed_name}}

      feed_name == :author_feed and is_nil(Keyword.get(opts, :author_id)) ->
        {:error, :author_id_required}

      true ->
        with {:ok, limit} <- get_limit(feed_name, opts),
             {:ok, cursor_payload} <- get_cursor(feed_name, opts) do
          execute_fetch(feed_name, cursor_payload, limit, opts)
        end
    end
  end

  @doc """
  Drives infinite scroll forwards.
  """
  def walk(feed_name, opts \\ []) do
    walk_forward(feed_name, opts, [], nil)
  end

  @doc """
  Drives infinite scroll backwards.
  """
  def walk_back(feed_name, opts \\ []) do
    case walk_forward_collect(feed_name, opts, [], nil) do
      {:ok, []} ->
        {:ok, %{pages: [[]], total: 0}}

      {:ok, forward_pages} ->
        last_page = List.last(forward_pages)
        first_total = hd(forward_pages).total

        backward_pages_acc = [Enum.map(last_page.items, & &1.id)]
        walk_backward(feed_name, opts, last_page.prev_cursor, backward_pages_acc, first_total)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp get_limit(feed_name, opts) do
    action = Ash.Resource.Info.action(Feed.Timeline.Activity, feed_name)
    max_limit = action.pagination && action.pagination.max_page_size
    default_limit = action.pagination && action.pagination.default_limit

    case Keyword.get(opts, :limit) do
      nil ->
        {:ok, default_limit}

      limit when is_integer(limit) and limit > 0 ->
        if max_limit && limit > max_limit do
          {:error, {:limit_too_large, max_limit}}
        else
          {:ok, limit}
        end

      _ ->
        {:error, :invalid_limit}
    end
  end

  defp get_cursor(feed_name, opts) do
    case Keyword.get(opts, :cursor) do
      nil ->
        {:ok, nil}

      cursor ->
        case Feed.Cursor.decode(cursor) do
          {:ok, %{feed: ^feed_name} = payload} ->
            {:ok, payload}

          {:ok, %{feed: _other_feed}} ->
            {:error, :cursor_feed_mismatch}

          {:error, :invalid_cursor} ->
            {:error, :invalid_cursor}
        end
    end
  end

  defp execute_fetch(feed_name, cursor_payload, limit, opts) do
    page_opts = [limit: limit, count: true]

    page_opts =
      case cursor_payload do
        %{direction: :next, keyset: keyset} ->
          Keyword.put(page_opts, :after, keyset)

        %{direction: :prev, keyset: keyset} ->
          Keyword.put(page_opts, :before, keyset)

        nil ->
          page_opts
      end

    main_opts = [
      load: [:author, :reaction_count, :heat],
      page: page_opts
    ]

    args = Keyword.take(opts, [:author_id])

    case call_domain_feed(feed_name, args, main_opts) do
      {:ok, page} ->
        items = page.results
        total = page.count

        if items == [] do
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
          first_keyset = List.first(items).__metadata__.keyset
          last_keyset = List.last(items).__metadata__.keyset

          has_prev = check_has_prev(feed_name, args, first_keyset)
          has_next = check_has_next(feed_name, args, last_keyset)

          next_cursor =
            if has_next do
              Feed.Cursor.encode(%{feed: feed_name, direction: :next, keyset: last_keyset})
            else
              nil
            end

          prev_cursor =
            if has_prev do
              Feed.Cursor.encode(%{feed: feed_name, direction: :prev, keyset: first_keyset})
            else
              nil
            end

          {:ok,
           %{
             items: items,
             next_cursor: next_cursor,
             prev_cursor: prev_cursor,
             total: total,
             has_next: has_next,
             has_prev: has_prev
           }}
        end

      {:error, error} ->
        {:error, error}
    end
  end

  defp call_domain_feed(:author_feed, args, opts) do
    author_id = Keyword.fetch!(args, :author_id)
    Feed.Timeline.author_feed(author_id, opts)
  end

  defp call_domain_feed(feed_name, _args, opts) do
    apply(Feed.Timeline, feed_name, [opts])
  end

  defp check_has_prev(feed_name, args, keyset) do
    opts = [page: [limit: 1, before: keyset]]
    case call_domain_feed(feed_name, args, opts) do
      {:ok, %{results: [_ | _]}} -> true
      _ -> false
    end
  end

  defp check_has_next(feed_name, args, keyset) do
    opts = [page: [limit: 1, after: keyset]]
    case call_domain_feed(feed_name, args, opts) do
      {:ok, %{results: [_ | _]}} -> true
      _ -> false
    end
  end

  defp walk_forward(feed_name, opts, acc_pages, first_total) do
    case fetch(feed_name, opts) do
      {:ok, %{items: [], total: total}} ->
        if acc_pages == [] do
          {:ok, %{pages: [[]], total: total}}
        else
          {:ok, %{pages: Enum.reverse(acc_pages), total: first_total}}
        end

      {:ok, %{items: items, next_cursor: next_cursor, total: total}} ->
        first_total = first_total || total
        ids = Enum.map(items, & &1.id)
        new_acc = [ids | acc_pages]

        if next_cursor do
          new_opts = Keyword.put(opts, :cursor, next_cursor)
          walk_forward(feed_name, new_opts, new_acc, first_total)
        else
          {:ok, %{pages: Enum.reverse(new_acc), total: first_total}}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp walk_forward_collect(feed_name, opts, acc, first_total) do
    case fetch(feed_name, opts) do
      {:ok, %{items: [], total: _total}} ->
        if acc == [] do
          {:ok, []}
        else
          {:ok, Enum.reverse(acc)}
        end

      {:ok, %{items: _items, next_cursor: next_cursor, prev_cursor: _prev_cursor, total: total} = page} ->
        first_total = first_total || total
        new_acc = [page | acc]

        if next_cursor do
          new_opts = Keyword.put(opts, :cursor, next_cursor)
          walk_forward_collect(feed_name, new_opts, new_acc, first_total)
        else
          {:ok, Enum.reverse(new_acc)}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp walk_backward(feed_name, opts, prev_cursor, acc, total) do
    if is_nil(prev_cursor) do
      {:ok, %{pages: acc, total: total}}
    else
      new_opts = Keyword.put(opts, :cursor, prev_cursor)

      case fetch(feed_name, new_opts) do
        {:ok, %{items: items, prev_cursor: next_prev_cursor}} ->
          ids = Enum.map(items, & &1.id)
          walk_backward(feed_name, opts, next_prev_cursor, acc ++ [ids], total)

        {:error, reason} ->
          {:error, reason}
      end
    end
  end
end
