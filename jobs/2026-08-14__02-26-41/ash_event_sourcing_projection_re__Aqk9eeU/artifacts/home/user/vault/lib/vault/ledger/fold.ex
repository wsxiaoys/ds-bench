defmodule Vault.Ledger.Fold do
  alias Vault.Ledger.AccountState

  @valid_types [:account_opened, :deposited, :withdrawn, :frozen, :unfrozen]

  def initial(account_id) do
    %AccountState{account_id: account_id}
  end

  def apply_event(%AccountState{} = state, event) do
    cond do
      state.account_id != nil and event.account_id != state.account_id ->
        {:error, {:account_mismatch, state.account_id, event.account_id}}

      event.version != state.version + 1 ->
        {:error, {:version_gap, state.version + 1, event.version}}

      event.payload.type not in @valid_types ->
        {:error, {:unknown_event_type, event.payload.type}}

      true ->
        payload_val = event.payload.value
        case transition(state, event.payload.type, payload_val) do
          {:ok, next_state} ->
            {:ok, %{next_state |
              version: event.version,
              last_event_type: event.payload.type,
              last_recorded_at: event.recorded_at
            }}

          {:error, reason} ->
            {:error, reason}
        end
    end
  end

  defp transition(state, :account_opened, payload) do
    if state.status == :absent do
      {:ok, %{state |
        owner: payload.owner,
        balance_cents: payload.opening_balance_cents,
        status: :open
      }}
    else
      {:error, :already_open}
    end
  end

  defp transition(state, :deposited, payload) do
    case state.status do
      :open ->
        {:ok, %{state |
          balance_cents: state.balance_cents + payload.amount_cents,
          deposit_count: state.deposit_count + 1
        }}

      :absent ->
        {:error, :account_absent}

      :frozen ->
        {:error, :account_frozen}
    end
  end

  defp transition(state, :withdrawn, payload) do
    case state.status do
      :open ->
        new_balance = state.balance_cents - payload.amount_cents
        if new_balance >= 0 do
          {:ok, %{state |
            balance_cents: new_balance,
            withdrawal_count: state.withdrawal_count + 1
          }}
        else
          {:error, :insufficient_funds}
        end

      :absent ->
        {:error, :account_absent}

      :frozen ->
        {:error, :account_frozen}
    end
  end

  defp transition(state, :frozen, _payload) do
    if state.status == :open do
      {:ok, %{state | status: :frozen}}
    else
      {:error, :not_open}
    end
  end

  defp transition(state, :unfrozen, _payload) do
    if state.status == :frozen do
      {:ok, %{state | status: :open}}
    else
      {:error, :not_frozen}
    end
  end

  def replay(%AccountState{} = state, events) do
    case check_order(events) do
      {:error, reason} ->
        {:error, reason}

      :ok ->
        Enum.reduce_while(events, {:ok, state}, fn event, {:ok, acc_state} ->
          case apply_event(acc_state, event) do
            {:ok, next_state} -> {:cont, {:ok, next_state}}
            {:error, reason} -> {:halt, {:error, reason}}
          end
        end)
    end
  end

  defp check_order(events) do
    events
    |> Enum.chunk_every(2, 1, :discard)
    |> Enum.find_index(fn [prev, curr] ->
      prev.sequence >= curr.sequence
    end)
    |> case do
      nil -> :ok
      index -> {:error, {:out_of_order, index + 1}}
    end
  end
end
