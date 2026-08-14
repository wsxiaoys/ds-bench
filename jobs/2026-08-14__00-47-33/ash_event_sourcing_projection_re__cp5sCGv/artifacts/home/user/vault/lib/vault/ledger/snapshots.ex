defmodule Vault.Ledger.Snapshots do
  require Ash.Query
  alias Vault.Ledger.AccountState
  alias Vault.Ledger.Snapshot

  def interval, do: 5

  def dump(%AccountState{} = state) do
    %{
      "account_id" => state.account_id,
      "owner" => state.owner,
      "balance_cents" => state.balance_cents,
      "status" => to_str(state.status),
      "version" => state.version,
      "deposit_count" => state.deposit_count,
      "withdrawal_count" => state.withdrawal_count,
      "last_event_type" => to_str(state.last_event_type),
      "last_recorded_at" => to_iso8601(state.last_recorded_at)
    }
  end

  def restore(map) when is_map(map) do
    %AccountState{
      account_id: map["account_id"],
      owner: map["owner"],
      balance_cents: map["balance_cents"],
      status: to_atom(map["status"]),
      version: map["version"],
      deposit_count: map["deposit_count"],
      withdrawal_count: map["withdrawal_count"],
      last_event_type: to_atom(map["last_event_type"]),
      last_recorded_at: to_datetime(map["last_recorded_at"])
    }
  end

  def checksum(%AccountState{} = state) do
    status_str = if state.status, do: Atom.to_string(state.status), else: ""
    data = [
      state.account_id,
      to_string(state.version),
      to_string(state.balance_cents),
      status_str,
      to_string(state.deposit_count),
      to_string(state.withdrawal_count)
    ]
    |> Enum.join("|")

    :crypto.hash(:sha256, data)
    |> Base.encode16(case: :lower)
  end

  def latest(account_id) do
    query =
      Snapshot
      |> Ash.Query.new()
      |> Ash.Query.filter(account_id == ^account_id)
      |> Ash.Query.sort(version: :desc)
      |> Ash.Query.limit(1)

    case Ash.read!(query) do
      [snapshot] -> {:ok, snapshot}
      [] -> :none
    end
  end

  def verify(%Snapshot{} = snapshot) do
    state = restore(snapshot.state)
    cond do
      checksum(state) != snapshot.checksum ->
        {:error, :checksum_mismatch}
      state.version != snapshot.version ->
        {:error, :version_mismatch}
      true ->
        :ok
    end
  end

  defp to_str(nil), do: nil
  defp to_str(atom) when is_atom(atom), do: Atom.to_string(atom)
  defp to_str(str) when is_binary(str), do: str

  defp to_atom(nil), do: nil
  defp to_atom(str) when is_binary(str) do
    try do
      String.to_existing_atom(str)
    rescue
      _ -> String.to_atom(str)
    end
  end

  defp to_iso8601(nil), do: nil
  defp to_iso8601(%DateTime{} = dt), do: DateTime.to_iso8601(dt)
  defp to_iso8601(str) when is_binary(str), do: str

  defp to_datetime(nil), do: nil
  defp to_datetime(%DateTime{} = dt), do: dt
  defp to_datetime(str) when is_binary(str) do
    case DateTime.from_iso8601(str) do
      {:ok, dt, _} -> dt
      _ -> nil
    end
  end
end
