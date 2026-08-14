defmodule Vault.Ledger.Projector do
  alias Vault.Ledger.AccountState
  alias Vault.Ledger.AccountProjection
  alias Vault.Ledger.Checkpoint
  alias Vault.Ledger.Fold
  require Ash.Query

  @spec checkpoint() :: integer()
  def checkpoint do
    Checkpoint
    |> Ash.Query.filter(name == "account_projection")
    |> Ash.read!()
    |> case do
      [] -> 0
      [row] -> row.sequence
    end
  end

  @spec catch_up() :: {:ok, map()} | {:error, any()}
  def catch_up do
    cp = checkpoint()

    events = Vault.Ledger.Event
    |> Ash.Query.filter(sequence > ^cp)
    |> Ash.Query.sort(sequence: :asc)
    |> Ash.read!()

    process_events(events, 0, cp)
  end

  @spec rebuild_all() :: {:ok, map()} | {:error, any()}
  def rebuild_all do
    events = Vault.Ledger.Event
    |> Ash.Query.sort(sequence: :asc)
    |> Ash.read!()

    Vault.Ledger.Hook.run(:after_load)

    # Discard all projection rows
    AccountProjection
    |> Ash.read!()
    |> Enum.each(& Ash.destroy!(&1))

    # Discard checkpoint
    Checkpoint
    |> Ash.read!()
    |> Enum.each(& Ash.destroy!(&1))

    case process_events(events, 0, 0) do
      {:ok, %{checkpoint: seq}} ->
        rows_count = AccountProjection
        |> Ash.read!()
        |> Enum.count()

        {:ok, %{rows: rows_count, checkpoint: seq}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @spec state_at(String.t(), {:version, integer()} | {:timestamp, DateTime.t()}) :: {:ok, %AccountState{}} | {:error, any()}
  def state_at(account_id, {:version, n}) when is_integer(n) do
    cond do
      n < 0 ->
        {:error, :invalid_point}

      n == 0 ->
        {:ok, Fold.initial(account_id)}

      true ->
        events = Vault.Ledger.Event
        |> Ash.Query.filter(account_id == ^account_id and version <= ^n)
        |> Ash.Query.sort(sequence: :asc)
        |> Ash.read!()

        initial = Fold.initial(account_id)
        fold_until_failure(initial, events)
    end
  end

  def state_at(account_id, {:timestamp, %DateTime{} = dt}) do
    events = Vault.Ledger.Event
    |> Ash.Query.filter(account_id == ^account_id and recorded_at <= ^dt)
    |> Ash.Query.sort(sequence: :asc)
    |> Ash.read!()

    initial = Fold.initial(account_id)
    fold_until_failure(initial, events)
  end

  def state_at(_account_id, _other) do
    {:error, :invalid_point}
  end

  @spec audit(String.t()) :: list(map()) | {:error, any()}
  def audit(account_id) do
    events = Vault.Ledger.Event
    |> Ash.Query.filter(account_id == ^account_id)
    |> Ash.Query.sort(sequence: :asc)
    |> Ash.read!()

    initial = Fold.initial(account_id)

    Enum.reduce_while(events, {:ok, {initial, []}}, fn event, {:ok, {current_state, acc}} ->
      case Fold.apply_event(current_state, event) do
        {:ok, next_state} ->
          diff = %{
            sequence: event.sequence,
            version: event.version,
            type: event.payload.type,
            balance_before: current_state.balance_cents,
            balance_after: next_state.balance_cents,
            delta_cents: next_state.balance_cents - current_state.balance_cents,
            status_before: current_state.status,
            status_after: next_state.status,
            recorded_at: event.recorded_at
          }
          {:cont, {:ok, {next_state, [diff | acc]}}}

        {:error, reason} ->
          {:halt, {:error, {:fold_failed, event.sequence, reason}}}
      end
    end)
    |> case do
      {:ok, {_, acc}} -> Enum.reverse(acc)
      {:error, reason} -> {:error, reason}
    end
  end

  defp process_events([], applied_count, last_seq) do
    {:ok, %{applied: applied_count, checkpoint: last_seq}}
  end

  defp process_events([event | rest], applied_count, _last_seq) do
    proj_row = AccountProjection
    |> Ash.Query.filter(account_id == ^event.account_id)
    |> Ash.read!()
    |> case do
      [] -> nil
      [row] -> row
    end

    state = projection_to_state(proj_row, event.account_id)

    case Fold.apply_event(state, event) do
      {:ok, next_state} ->
        save_projection(proj_row, next_state, event.sequence)
        save_checkpoint(event.sequence)
        process_events(rest, applied_count + 1, event.sequence)

      {:error, reason} ->
        {:error, {:fold_failed, event.sequence, reason}}
    end
  end

  defp projection_to_state(nil, account_id) do
    Fold.initial(account_id)
  end

  defp projection_to_state(proj, _account_id) do
    %AccountState{
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
  end

  defp save_projection(nil, state, seq) do
    AccountProjection
    |> Ash.Changeset.for_create(:create, %{
      account_id: state.account_id,
      owner: state.owner,
      balance_cents: state.balance_cents,
      status: state.status,
      version: state.version,
      deposit_count: state.deposit_count,
      withdrawal_count: state.withdrawal_count,
      last_event_sequence: seq,
      last_recorded_at: state.last_recorded_at
    })
    |> Ash.create!()
  end

  defp save_projection(row, state, seq) do
    row
    |> Ash.Changeset.for_update(:update, %{
      owner: state.owner,
      balance_cents: state.balance_cents,
      status: state.status,
      version: state.version,
      deposit_count: state.deposit_count,
      withdrawal_count: state.withdrawal_count,
      last_event_sequence: seq,
      last_recorded_at: state.last_recorded_at
    })
    |> Ash.update!()
  end

  defp save_checkpoint(seq) do
    Checkpoint
    |> Ash.Query.filter(name == "account_projection")
    |> Ash.read!()
    |> case do
      [] ->
        Checkpoint
        |> Ash.Changeset.for_create(:create, %{name: "account_projection", sequence: seq})
        |> Ash.create!()

      [row] ->
        row
        |> Ash.Changeset.for_update(:update, %{sequence: seq})
        |> Ash.update!()
    end
  end

  defp fold_until_failure(state, events) do
    Enum.reduce_while(events, {:ok, state}, fn event, {:ok, current_state} ->
      case Fold.apply_event(current_state, event) do
        {:ok, next_state} -> {:cont, {:ok, next_state}}
        {:error, reason} -> {:halt, {:error, {:fold_failed, event.sequence, reason}}}
      end
    end)
  end
end
