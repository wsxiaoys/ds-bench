defmodule Vault.Ledger.Fold do
  alias Vault.Ledger.AccountState

  @spec initial(String.t()) :: %AccountState{}
  def initial(account_id) do
    %AccountState{account_id: account_id}
  end

  @spec apply_event(%AccountState{}, struct()) :: {:ok, %AccountState{}} | {:error, any()}
  def apply_event(state, event) do
    # Rejection 1: account_id mismatch
    cond do
      not is_nil(state.account_id) and event.account_id != state.account_id ->
        {:error, {:account_mismatch, state.account_id, event.account_id}}

      # Rejection 2: version gap
      event.version != state.version + 1 ->
        {:error, {:version_gap, state.version + 1, event.version}}

      # Rejection 3: payload's union member is none of the five
      event.payload.type not in [:account_opened, :deposited, :withdrawn, :frozen, :unfrozen] ->
        {:error, {:unknown_event_type, event.payload.type}}

      true ->
        # Business rules and state transitions
        payload_val = event.payload.value

        case event.payload.type do
          :account_opened ->
            if state.status == :absent do
              {:ok, %AccountState{
                state |
                owner: payload_val.owner,
                balance_cents: payload_val.opening_balance_cents,
                status: :open,
                version: event.version,
                last_event_type: :account_opened,
                last_recorded_at: event.recorded_at
              }}
            else
              {:error, :already_open}
            end

          :deposited ->
            case state.status do
              :absent -> {:error, :account_absent}
              :frozen -> {:error, :account_frozen}
              :open ->
                {:ok, %AccountState{
                  state |
                  balance_cents: state.balance_cents + payload_val.amount_cents,
                  deposit_count: state.deposit_count + 1,
                  status: :open,
                  version: event.version,
                  last_event_type: :deposited,
                  last_recorded_at: event.recorded_at
                }}
            end

          :withdrawn ->
            case state.status do
              :absent -> {:error, :account_absent}
              :frozen -> {:error, :account_frozen}
              :open ->
                new_balance = state.balance_cents - payload_val.amount_cents
                if new_balance >= 0 do
                  {:ok, %AccountState{
                    state |
                    balance_cents: new_balance,
                    withdrawal_count: state.withdrawal_count + 1,
                    status: :open,
                    version: event.version,
                    last_event_type: :withdrawn,
                    last_recorded_at: event.recorded_at
                  }}
                else
                  {:error, :insufficient_funds}
                end
            end

          :frozen ->
            if state.status == :open do
              {:ok, %AccountState{
                state |
                status: :frozen,
                version: event.version,
                last_event_type: :frozen,
                last_recorded_at: event.recorded_at
              }}
            else
              {:error, :not_open}
            end

          :unfrozen ->
            if state.status == :frozen do
              {:ok, %AccountState{
                state |
                status: :open,
                version: event.version,
                last_event_type: :unfrozen,
                last_recorded_at: event.recorded_at
              }}
            else
              {:error, :not_frozen}
            end
        end
    end
  end

  @spec replay(%AccountState{}, list()) :: {:ok, %AccountState{}} | {:error, any()}
  def replay(state, events) do
    case check_order(events) do
      :ok ->
        Enum.reduce_while(events, {:ok, state}, fn event, {:ok, current_state} ->
          case apply_event(current_state, event) do
            {:ok, next_state} -> {:cont, {:ok, next_state}}
            {:error, reason} -> {:halt, {:error, reason}}
          end
        end)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp check_order(events) do
    Enum.reduce_while(events, {nil, 0}, fn event, {prev_seq, index} ->
      cond do
        is_nil(prev_seq) ->
          {:cont, {event.sequence, index + 1}}

        event.sequence > prev_seq ->
          {:cont, {event.sequence, index + 1}}

        true ->
          {:halt, {:error, {:out_of_order, index}}}
      end
    end)
    |> case do
      {:error, error} -> {:error, error}
      _ -> :ok
    end
  end
end
