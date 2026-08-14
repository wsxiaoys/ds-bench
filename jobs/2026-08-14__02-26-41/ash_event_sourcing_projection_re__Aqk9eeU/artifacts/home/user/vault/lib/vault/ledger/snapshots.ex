defmodule Vault.Ledger.Snapshots do
  alias Vault.Ledger.AccountState
  alias Vault.Ledger.Snapshot
  require Ash.Query

  def interval, do: 5

  def dump(%AccountState{} = state) do
    %{
      "account_id" => state.account_id,
      "owner" => state.owner,
      "balance_cents" => state.balance_cents,
      "status" => if(is_nil(state.status), do: nil, else: to_string(state.status)),
      "version" => state.version,
      "deposit_count" => state.deposit_count,
      "withdrawal_count" => state.withdrawal_count,
      "last_event_type" => if(is_nil(state.last_event_type), do: nil, else: to_string(state.last_event_type)),
      "last_recorded_at" => if(is_nil(state.last_recorded_at), do: nil, else: DateTime.to_iso8601(state.last_recorded_at))
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
      last_recorded_at: parse_datetime(map["last_recorded_at"])
    }
  end

  def checksum(%AccountState{} = state) do
    str = "#{state.account_id}|#{state.version}|#{state.balance_cents}|#{state.status}|#{state.deposit_count}|#{state.withdrawal_count}"
    :crypto.hash(:sha256, str)
    |> Base.encode16(case: :lower)
  end

  def latest(account_id) do
    Vault.Ledger.Snapshot
    |> Ash.Query.filter(account_id == ^account_id)
    |> Ash.Query.sort(version: :desc)
    |> Ash.Query.limit(1)
    |> Ash.read_one(authorize?: false)
    |> case do
      {:ok, nil} -> :none
      {:ok, snapshot} -> {:ok, snapshot}
      {:error, _} -> :none
    end
  end

  def verify(%Snapshot{} = snapshot) do
    state = restore(snapshot.state)
    expected_checksum = checksum(state)

    cond do
      expected_checksum != snapshot.checksum ->
        {:error, :checksum_mismatch}

      state.version != snapshot.version ->
        {:error, :version_mismatch}

      true ->
        :ok
    end
  end

  defp to_atom(nil), do: nil
  defp to_atom(str) when is_binary(str) do
    try do
      String.to_existing_atom(str)
    rescue
      ArgumentError -> String.to_atom(str)
    end
  end

  defp parse_datetime(nil), do: nil
  defp parse_datetime(str) when is_binary(str) do
    case DateTime.from_iso8601(str) do
      {:ok, dt, _} -> dt
      _ -> nil
    end
  end
end
