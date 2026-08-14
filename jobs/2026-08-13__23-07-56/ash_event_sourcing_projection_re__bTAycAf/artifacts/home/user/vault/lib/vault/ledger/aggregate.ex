defmodule Vault.Ledger.Aggregate do
  alias Vault.Ledger.AccountState
  require Ash.Query

  @spec fold_all(String.t()) :: {:ok, %AccountState{}} | {:error, any()}
  def fold_all(account_id) do
    events = Vault.Ledger.Event
    |> Ash.Query.filter(account_id == ^account_id)
    |> Ash.Query.sort(sequence: :asc)
    |> Ash.read!()

    initial_state = Vault.Ledger.Fold.initial(account_id)
    Vault.Ledger.Fold.replay(initial_state, events)
  end

  @spec current(String.t()) :: {:ok, %AccountState{}} | {:error, any()}
  def current(account_id) do
    snapshots = Vault.Ledger.Snapshot
    |> Ash.Query.filter(account_id == ^account_id)
    |> Ash.Query.sort(version: :desc)
    |> Ash.read!()

    valid_snapshot = Enum.find(snapshots, fn snap ->
      case Vault.Ledger.Snapshots.verify(snap) do
        :ok -> true
        _ -> false
      end
    end)

    case valid_snapshot do
      nil ->
        fold_all(account_id)

      snapshot ->
        state = Vault.Ledger.Snapshots.restore(snapshot.state)

        events = Vault.Ledger.Event
        |> Ash.Query.filter(account_id == ^account_id and version > ^snapshot.version)
        |> Ash.Query.sort(sequence: :asc)
        |> Ash.read!()

        Vault.Ledger.Fold.replay(state, events)
    end
  end
end
