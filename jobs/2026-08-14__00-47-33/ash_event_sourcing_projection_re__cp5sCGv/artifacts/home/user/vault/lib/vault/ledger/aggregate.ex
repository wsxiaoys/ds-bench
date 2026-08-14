defmodule Vault.Ledger.Aggregate do
  require Ash.Query
  alias Vault.Ledger.Fold
  alias Vault.Ledger.Snapshots
  alias Vault.Ledger.Event
  alias Vault.Ledger.Snapshot

  def fold_all(account_id) do
    initial_state = Fold.initial(account_id)

    query =
      Event
      |> Ash.Query.new()
      |> Ash.Query.filter(account_id == ^account_id)
      |> Ash.Query.sort(version: :asc)

    events = Ash.read!(query)
    Fold.replay(initial_state, events)
  end

  def current(account_id) do
    query =
      Snapshot
      |> Ash.Query.new()
      |> Ash.Query.filter(account_id == ^account_id)
      |> Ash.Query.sort(version: :desc)

    snapshots = Ash.read!(query)

    valid_snapshot =
      snapshots
      |> Enum.find(fn sn ->
        case Snapshots.verify(sn) do
          :ok -> true
          _ -> false
        end
      end)

    case valid_snapshot do
      nil ->
        fold_all(account_id)

      snapshot ->
        state = Snapshots.restore(snapshot.state)

        query =
          Event
          |> Ash.Query.new()
          |> Ash.Query.filter(account_id == ^account_id and version > ^snapshot.version)
          |> Ash.Query.sort(version: :asc)

        events = Ash.read!(query)
        Fold.replay(state, events)
    end
  end
end
