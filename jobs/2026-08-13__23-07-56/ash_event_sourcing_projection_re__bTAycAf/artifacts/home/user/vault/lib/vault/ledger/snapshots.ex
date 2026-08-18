defmodule Vault.Ledger.Snapshots do
  alias Vault.Ledger.AccountState
  alias Vault.Ledger.Snapshot
  require Ash.Query

  @spec interval() :: 5
  def interval, do: 5

  @spec dump(%AccountState{}) :: map()
  def dump(%AccountState{} = state) do
    %{
      "account_id" => state.account_id,
      "owner" => state.owner,
      "balance_cents" => state.balance_cents,
      "status" => if(state.status, do: to_string(state.status)),
      "version" => state.version,
      "deposit_count" => state.deposit_count,
      "withdrawal_count" => state.withdrawal_count,
      "last_event_type" => if(state.last_event_type, do: to_string(state.last_event_type)),
      "last_recorded_at" => if(state.last_recorded_at, do: DateTime.to_iso8601(state.last_recorded_at))
    }
  end

  @spec restore(map()) :: %AccountState{}
  def restore(map) do
    status = if map["status"], do: String.to_existing_atom(map["status"])
    last_event_type = if map["last_event_type"], do: String.to_existing_atom(map["last_event_type"])
    last_recorded_at = if map["last_recorded_at"] do
      {:ok, dt, _} = DateTime.from_iso8601(map["last_recorded_at"])
      dt
    end

    %AccountState{
      account_id: map["account_id"],
      owner: map["owner"],
      balance_cents: map["balance_cents"],
      status: status,
      version: map["version"],
      deposit_count: map["deposit_count"],
      withdrawal_count: map["withdrawal_count"],
      last_event_type: last_event_type,
      last_recorded_at: last_recorded_at
    }
  end

  @spec checksum(%AccountState{}) :: String.t()
  def checksum(%AccountState{} = state) do
    str = "#{state.account_id}|#{state.version}|#{state.balance_cents}|#{state.status}|#{state.deposit_count}|#{state.withdrawal_count}"
    :crypto.hash(:sha256, str)
    |> Base.encode16(case: :lower)
  end

  @spec latest(String.t()) :: {:ok, %Snapshot{}} | :none
  def latest(account_id) do
    Vault.Ledger.Snapshot
    |> Ash.Query.filter(account_id == ^account_id)
    |> Ash.read!()
    |> case do
      [] -> :none
      snapshots ->
        latest_snapshot = Enum.max_by(snapshots, & &1.version)
        {:ok, latest_snapshot}
    end
  end

  @spec verify(%Snapshot{}) :: :ok | {:error, :checksum_mismatch | :version_mismatch}
  def verify(snapshot) do
    restored = restore(snapshot.state)
    cond do
      checksum(restored) != snapshot.checksum ->
        {:error, :checksum_mismatch}

      restored.version != snapshot.version ->
        {:error, :version_mismatch}

      true ->
        :ok
    end
  end
end
