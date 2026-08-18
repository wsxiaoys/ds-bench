defmodule Vault.Ledger.Projector do
  alias Vault.Ledger.Event
  alias Vault.Ledger.AccountProjection
  alias Vault.Ledger.Checkpoint
  alias Vault.Ledger.Fold
  alias Vault.Ledger.AccountState
  require Ash.Query

  def checkpoint do
    Checkpoint
    |> Ash.get("account_projection", authorize?: false)
    |> case do
      {:ok, row} -> row.sequence
      {:error, _} -> 0
    end
  end

  def catch_up do
    current_seq = checkpoint()

    events =
      Event
      |> Ash.Query.filter(sequence > ^current_seq)
      |> Ash.Query.sort(sequence: :asc)
      |> Ash.read!(authorize?: false)

    do_catch_up(events, 0, current_seq)
  end

  def rebuild_all do
    events =
      Event
      |> Ash.Query.sort(sequence: :asc)
      |> Ash.read!(authorize?: false)

    Vault.Ledger.Hook.run(:after_load)

    # Discard all projection rows
    AccountProjection
    |> Ash.read!(authorize?: false)
    |> Enum.each(&Ash.destroy!(&1, authorize?: false))

    # We also reset the checkpoint to 0 initially, in case there are no events
    update_checkpoint!(0)

    case do_catch_up(events, 0, 0) do
      {:ok, %{applied: _, checkpoint: seq}} ->
        rows_count =
          AccountProjection
          |> Ash.read!(authorize?: false)
          |> Enum.count()

        {:ok, %{rows: rows_count, checkpoint: seq}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def state_at(account_id, {:version, n}) when is_integer(n) do
    cond do
      n < 0 ->
        {:error, :invalid_point}

      n == 0 ->
        {:ok, Fold.initial(account_id)}

      true ->
        events =
          Event
          |> Ash.Query.filter(account_id == ^account_id and version <= ^n)
          |> Ash.Query.sort(version: :asc)
          |> Ash.read!(authorize?: false)

        fold_events_with_error_handling(account_id, events)
    end
  end

  def state_at(account_id, {:timestamp, %DateTime{} = dt}) do
    events =
      Event
      |> Ash.Query.filter(account_id == ^account_id and recorded_at <= ^dt)
      |> Ash.Query.sort(version: :asc)
      |> Ash.read!(authorize?: false)

    fold_events_with_error_handling(account_id, events)
  end

  def state_at(_account_id, _other) do
    {:error, :invalid_point}
  end

  def audit(account_id) do
    events =
      Event
      |> Ash.Query.filter(account_id == ^account_id)
      |> Ash.Query.sort(version: :asc)
      |> Ash.read!(authorize?: false)

    state = Fold.initial(account_id)

    case do_audit(events, state, []) do
      {:ok, list} -> list
      {:error, reason} -> {:error, reason}
    end
  end

  defp do_catch_up([], applied, seq) do
    {:ok, %{applied: applied, checkpoint: seq}}
  end

  defp do_catch_up([event | rest], applied, _seq) do
    state = get_projection_state(event.account_id)

    case Fold.apply_event(state, event) do
      {:ok, next_state} ->
        update_projection!(next_state, event.sequence)
        update_checkpoint!(event.sequence)
        do_catch_up(rest, applied + 1, event.sequence)

      {:error, reason} ->
        {:error, {:fold_failed, event.sequence, reason}}
    end
  end

  defp get_projection_state(account_id) do
    AccountProjection
    |> Ash.get(account_id, authorize?: false)
    |> case do
      {:ok, row} ->
        %AccountState{
          account_id: row.account_id,
          owner: row.owner,
          balance_cents: row.balance_cents,
          status: row.status,
          version: row.version,
          deposit_count: row.deposit_count,
          withdrawal_count: row.withdrawal_count,
          last_recorded_at: row.last_recorded_at
        }

      {:error, _} ->
        Fold.initial(account_id)
    end
  end

  defp update_projection!(state, last_event_sequence) do
    projection =
      AccountProjection
      |> Ash.get(state.account_id, authorize?: false)

    attrs = %{
      owner: state.owner,
      balance_cents: state.balance_cents,
      status: state.status,
      version: state.version,
      deposit_count: state.deposit_count,
      withdrawal_count: state.withdrawal_count,
      last_event_sequence: last_event_sequence,
      last_recorded_at: state.last_recorded_at
    }

    case projection do
      {:ok, row} ->
        row
        |> Ash.Changeset.for_update(:update, attrs)
        |> Ash.update!(authorize?: false)

      {:error, _} ->
        AccountProjection
        |> Ash.Changeset.for_create(:create, Map.put(attrs, :account_id, state.account_id))
        |> Ash.create!(authorize?: false)
    end
  end

  defp update_checkpoint!(sequence) do
    checkpoint =
      Checkpoint
      |> Ash.get("account_projection", authorize?: false)

    case checkpoint do
      {:ok, row} ->
        row
        |> Ash.Changeset.for_update(:update, %{sequence: sequence})
        |> Ash.update!(authorize?: false)

      {:error, _} ->
        Checkpoint
        |> Ash.Changeset.for_create(:create, %{name: "account_projection", sequence: sequence})
        |> Ash.create!(authorize?: false)
    end
  end

  defp fold_events_with_error_handling(account_id, events) do
    state = Fold.initial(account_id)

    Enum.reduce_while(events, {:ok, state}, fn event, {:ok, acc_state} ->
      case Fold.apply_event(acc_state, event) do
        {:ok, next_state} ->
          {:cont, {:ok, next_state}}

        {:error, reason} ->
          {:halt, {:error, {:fold_failed, event.sequence, reason}}}
      end
    end)
  end

  defp do_audit([], _state, acc) do
    {:ok, Enum.reverse(acc)}
  end

  defp do_audit([event | rest], state, acc) do
    case Fold.apply_event(state, event) do
      {:ok, next_state} ->
        diff = %{
          sequence: event.sequence,
          version: event.version,
          type: event.payload.type,
          balance_before: state.balance_cents,
          balance_after: next_state.balance_cents,
          delta_cents: next_state.balance_cents - state.balance_cents,
          status_before: state.status,
          status_after: next_state.status,
          recorded_at: event.recorded_at
        }
        do_audit(rest, next_state, [diff | acc])

      {:error, reason} ->
        {:error, {:fold_failed, event.sequence, reason}}
    end
  end
end
