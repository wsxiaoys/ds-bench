defmodule Vault.Ledger.Event do
  use Ash.Resource,
    domain: Vault.Ledger,
    data_layer: Ash.DataLayer.Ets

  ets do
    private? true
  end

  attributes do
    uuid_primary_key :id

    attribute :sequence, :integer, allow_nil?: false, public?: true
    attribute :account_id, :string, allow_nil?: false, public?: true
    attribute :version, :integer, allow_nil?: false, public?: true
    attribute :payload, Vault.Ledger.Payload, allow_nil?: false, public?: true
    attribute :recorded_at, :utc_datetime_usec, allow_nil?: false, public?: true
  end

  identities do
    identity :unique_version, [:account_id, :version] do
      pre_check_with Vault.Ledger
    end

    identity :unique_sequence, [:sequence] do
      pre_check_with Vault.Ledger
    end
  end

  actions do
    defaults [:read]

    create :append do
      accept [:account_id, :version, :payload, :recorded_at]
      change Vault.Ledger.Event.AppendChange
    end

    action :open_account, :struct do
      argument :account_id, :string, allow_nil?: false
      argument :owner, :string, allow_nil?: false
      argument :opening_balance_cents, :integer, default: 0
      argument :recorded_at, :utc_datetime_usec, allow_nil?: true

      run fn input, _context ->
        Vault.Ledger.CommandHandler.open_account(
          input.arguments.account_id,
          input.arguments.owner,
          input.arguments.opening_balance_cents,
          Map.get(input.arguments, :recorded_at)
        )
      end
    end

    action :deposit, :struct do
      argument :account_id, :string, allow_nil?: false
      argument :amount_cents, :integer, allow_nil?: false
      argument :recorded_at, :utc_datetime_usec, allow_nil?: true

      run fn input, _context ->
        Vault.Ledger.CommandHandler.deposit(
          input.arguments.account_id,
          input.arguments.amount_cents,
          Map.get(input.arguments, :recorded_at)
        )
      end
    end

    action :withdraw, :struct do
      argument :account_id, :string, allow_nil?: false
      argument :amount_cents, :integer, allow_nil?: false
      argument :recorded_at, :utc_datetime_usec, allow_nil?: true

      run fn input, _context ->
        Vault.Ledger.CommandHandler.withdraw(
          input.arguments.account_id,
          input.arguments.amount_cents,
          Map.get(input.arguments, :recorded_at)
        )
      end
    end

    action :transfer, :struct do
      argument :from_account_id, :string, allow_nil?: false
      argument :to_account_id, :string, allow_nil?: false
      argument :amount_cents, :integer, allow_nil?: false
      argument :recorded_at, :utc_datetime_usec, allow_nil?: true

      run fn input, _context ->
        Vault.Ledger.CommandHandler.transfer(
          input.arguments.from_account_id,
          input.arguments.to_account_id,
          input.arguments.amount_cents,
          Map.get(input.arguments, :recorded_at)
        )
      end
    end

    action :freeze, :struct do
      argument :account_id, :string, allow_nil?: false
      argument :reason, :atom, allow_nil?: false
      argument :recorded_at, :utc_datetime_usec, allow_nil?: true

      run fn input, _context ->
        Vault.Ledger.CommandHandler.freeze(
          input.arguments.account_id,
          input.arguments.reason,
          Map.get(input.arguments, :recorded_at)
        )
      end
    end

    action :unfreeze, :struct do
      argument :account_id, :string, allow_nil?: false
      argument :note, :string, allow_nil?: true
      argument :recorded_at, :utc_datetime_usec, allow_nil?: true

      run fn input, _context ->
        Vault.Ledger.CommandHandler.unfreeze(
          input.arguments.account_id,
          Map.get(input.arguments, :note),
          Map.get(input.arguments, :recorded_at)
        )
      end
    end
  end
end

defmodule Vault.Ledger.Event.AppendChange do
  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, _context) do
    Ash.Changeset.before_action(changeset, fn changeset ->
      account_id = Ash.Changeset.get_attribute(changeset, :account_id)
      version = Ash.Changeset.get_attribute(changeset, :version)

      if is_nil(account_id) or is_nil(version) do
        changeset
      else
        all_events = Ash.read!(Vault.Ledger.Event)

        events_for_account = Enum.filter(all_events, &(&1.account_id == account_id))

        highest_version = case events_for_account do
          [] -> 0
          _ -> Enum.max_by(events_for_account, & &1.version).version
        end

        cond do
          version >= 1 and version <= highest_version ->
            Ash.Changeset.add_error(changeset, Ash.Error.Changes.InvalidChanges.exception(
              fields: [:account_id, :version],
              message: "has already been taken"
            ))

          version < 1 or version > highest_version + 1 ->
            Ash.Changeset.add_error(changeset, Ash.Error.Changes.InvalidAttribute.exception(
              field: :version,
              message: "version must be exactly one greater than the current stream version",
              vars: [expected: highest_version + 1]
            ))

          true ->
            next_sequence = case all_events do
              [] -> 1
              _ -> Enum.max_by(all_events, & &1.sequence).sequence + 1
            end

            Ash.Changeset.force_change_attribute(changeset, :sequence, next_sequence)
        end
      end
    end)
  end
end
