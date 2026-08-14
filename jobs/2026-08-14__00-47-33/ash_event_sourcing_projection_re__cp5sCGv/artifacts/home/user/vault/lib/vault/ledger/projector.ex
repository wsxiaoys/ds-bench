defmodule Vault.Ledger.Projector do
  require Ash.Query
  alias Vault.Ledger.Fold

  def checkpoint do
    case Ash.get(Vault.Ledger.Checkpoint, "account_projection") do
      {:ok, cp} -> cp.sequence
      _ -> 0
    end
  end

  def catch_up do
    seq = checkpoint()

    query =
      Vault.Ledger.Event
      |> Ash.Query.new()
      |> Ash.Query.filter(sequence > ^seq)
      |> Ash.Query.sort(sequence: :asc)

    events = Ash.read!(query)

    case apply_events_list(events, seq) do
      {:ok, n, last_seq} ->
        {:ok, %{applied: n, checkpoint: last_seq}}

      {:error, err} ->
        {:error, err}
    end
  end

  def rebuild_all do
    query =
      Vault.Ledger.Event
      |> Ash.Query.new()
      |> Ash.Query.sort(sequence: :asc)

    events = Ash.read!(query)

    Vault.Ledger.Hook.run(:after_load)

    # Discard all projection rows
    projections = Ash.read!(Vault.Ledger.AccountProjection)
    for p <- projections, do: Ash.destroy!(p)

    # Reset checkpoint to 0
    case Ash.get(Vault.Ledger.Checkpoint, "account_projection") do
      {:ok, cp} ->
        cp
        |> Ash.Changeset.for_update(:update, %{sequence: 0})
        |> Ash.update!()

      _ ->
        Vault.Ledger.Checkpoint
        |> Ash.Changeset.for_create(:create, %{name: "account_projection", sequence: 0})
        |> Ash.create!()
    end

    case apply_events_list(events, 0) do
      {:ok, _n, last_seq} ->
        final_projections = Ash.read!(Vault.Ledger.AccountProjection)
        {:ok, %{rows: Enum.count(final_projections), checkpoint: last_seq}}

      {:error, err} ->
        {:error, err}
    end
  end

  def state_at(account_id, point) do
    case validate_point(point) do
      :ok ->
        query =
          Vault.Ledger.Event
          |> Ash.Query.new()
          |> Ash.Query.filter(account_id == ^account_id)
          |> Ash.Query.sort(version: :asc)

        events = Ash.read!(query)

        filtered_events = filter_events_by_point(events, point)

        initial_state = Fold.initial(account_id)

        fold_events_safe(initial_state, filtered_events)

      {:error, :invalid_point} ->
        {:error, :invalid_point}
    end
  end

  def audit(account_id) do
    query =
      Vault.Ledger.Event
      |> Ash.Query.new()
      |> Ash.Query.filter(account_id == ^account_id)
      |> Ash.Query.sort(version: :asc)

    events = Ash.read!(query)

    initial_state = Fold.initial(account_id)
    do_audit(events, initial_state, [])
  end

  # --- Helpers ---

  defp validate_point({:version, n}) when is_integer(n) and n >= 0, do: :ok
  defp validate_point({:timestamp, %DateTime{}}), do: :ok
  defp validate_point(_), do: {:error, :invalid_point}

  defp filter_events_by_point(events, {:version, n}) do
    Enum.filter(events, &(&1.version <= n))
  end

  defp filter_events_by_point(events, {:timestamp, dt}) do
    Enum.filter(events, &(DateTime.compare(&1.recorded_at, dt) in [:lt, :eq]))
  end

  defp fold_events_safe(state, events) do
    Enum.reduce_while(events, {:ok, state}, fn event, {:ok, current_state} ->
      case Fold.apply_event(current_state, event) do
        {:ok, next_state} -> {:cont, {:ok, next_state}}
        {:error, reason} -> {:halt, {:error, {:fold_failed, event.sequence, reason}}}
      end
    end)
  end

  defp do_audit([], _state, acc), do: Enum.reverse(acc)
  defp do_audit([event | rest], state_before, acc) do
    case Fold.apply_event(state_before, event) do
      {:ok, state_after} ->
        type = extract_type(event.payload)

        entry = %{
          sequence: event.sequence,
          version: event.version,
          type: type,
          balance_before: state_before.balance_cents,
          balance_after: state_after.balance_cents,
          delta_cents: state_after.balance_cents - state_before.balance_cents,
          status_before: state_before.status,
          status_after: state_after.status,
          recorded_at: event.recorded_at
        }

        do_audit(rest, state_after, [entry | acc])

      {:error, reason} ->
        {:error, {:fold_failed, event.sequence, reason}}
    end
  end

  defp extract_type(payload) do
    case payload do
      %Ash.Union{type: type} -> type
      %{type: type} when is_atom(type) -> type
      %{"type" => type} when is_binary(type) ->
        try do
          String.to_existing_atom(type)
        rescue
          _ -> String.to_atom(type)
        end
      _ -> nil
    end
  end

  defp get_current_state(account_id) do
    case Ash.get(Vault.Ledger.AccountProjection, account_id) do
      {:ok, proj} ->
        state = %Vault.Ledger.AccountState{
          account_id: proj.account_id,
          owner: proj.owner,
          balance_cents: proj.balance_cents,
          status: proj.status,
          version: proj.version,
          deposit_count: proj.deposit_count,
          withdrawal_count: proj.withdrawal_count,
          last_event_type: nil,
          last_recorded_at: proj.last_recorded_at
        }
        {:ok, state, proj}

      _ ->
        {:ok, Fold.initial(account_id), nil}
    end
  end

  defp apply_events_list(events, initial_seq) do
    do_apply_events_list(events, 0, initial_seq)
  end

  defp do_apply_events_list([], applied_count, last_seq), do: {:ok, applied_count, last_seq}
  defp do_apply_events_list([event | rest], applied_count, _last_seq) do
    account_id = event.account_id
    {:ok, state, proj} = get_current_state(account_id)

    case Fold.apply_event(state, event) do
      {:ok, next_state} ->
        # Save projection
        if proj do
          proj
          |> Ash.Changeset.for_update(:update, %{
            owner: next_state.owner,
            balance_cents: next_state.balance_cents,
            status: next_state.status,
            version: next_state.version,
            deposit_count: next_state.deposit_count,
            withdrawal_count: next_state.withdrawal_count,
            last_event_sequence: event.sequence,
            last_recorded_at: next_state.last_recorded_at
          })
          |> Ash.update!()
        else
          Vault.Ledger.AccountProjection
          |> Ash.Changeset.for_create(:create, %{
            account_id: next_state.account_id,
            owner: next_state.owner,
            balance_cents: next_state.balance_cents,
            status: next_state.status,
            version: next_state.version,
            deposit_count: next_state.deposit_count,
            withdrawal_count: next_state.withdrawal_count,
            last_event_sequence: event.sequence,
            last_recorded_at: next_state.last_recorded_at
          })
          |> Ash.create!()
        end

        # Update checkpoint
        case Ash.get(Vault.Ledger.Checkpoint, "account_projection") do
          {:ok, cp} ->
            cp
            |> Ash.Changeset.for_update(:update, %{sequence: event.sequence})
            |> Ash.update!()

          _ ->
            Vault.Ledger.Checkpoint
            |> Ash.Changeset.for_create(:create, %{name: "account_projection", sequence: event.sequence})
            |> Ash.create!()
        end

        do_apply_events_list(rest, applied_count + 1, event.sequence)

      {:error, reason} ->
        {:error, {:fold_failed, event.sequence, reason}}
    end
  end
end
