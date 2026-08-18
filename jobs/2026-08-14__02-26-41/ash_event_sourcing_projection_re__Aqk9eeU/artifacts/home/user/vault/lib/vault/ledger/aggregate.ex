defmodule Vault.Ledger.Aggregate do
  alias Vault.Ledger.Fold
  alias Vault.Ledger.Snapshots
  alias Vault.Ledger.Event
  alias Vault.Ledger.Snapshot
  require Ash.Query

  def fold_all(account_id) do
    state = Fold.initial(account_id)

    events =
      Event
      |> Ash.Query.filter(account_id == ^account_id)
      |> Ash.Query.sort(version: :asc)
      |> Ash.read!(authorize?: false)

    Fold.replay(state, events)
  end

  def current(account_id) do
    snapshots =
      Snapshot
      |> Ash.Query.filter(account_id == ^account_id)
      |> Ash.Query.sort(version: :desc)
      |> Ash.read!(authorize?: false)

    valid_snapshot =
      Enum.find(snapshots, fn snapshot ->
        case Snapshots.verify(snapshot) do
          :ok -> true
          _ -> false
        end
      end)

    case valid_snapshot do
      nil ->
        fold_all(account_id)

      snapshot ->
        state = Snapshots.restore(snapshot.state)

        events =
          Event
          |> Ash.Query.filter(account_id == ^account_id and version > ^state.version)
          |> Ash.Query.sort(version: :asc)
          |> Ash.read!(authorize?: false)

        Fold.replay(state, events)
    end
  end
end
