defmodule Vault.Ledger.Event.AppendChange do
  use Ash.Resource.Change

  def change(changeset, _opts, _context) do
    changeset = check_no_such_input(changeset)

    if not changeset.valid? do
      changeset
    else
      account_id = Ash.Changeset.get_attribute(changeset, :account_id)
      version = Ash.Changeset.get_attribute(changeset, :version)

      if is_nil(account_id) or is_nil(version) do
        changeset
      else
        # Query existing events safely
        events =
          Vault.Ledger.Event
          |> Ash.Query.new()
          |> Ash.read!()

        highest_sequence =
          events
          |> Enum.map(& &1.sequence)
          |> Enum.max(fn -> 0 end)

        account_events =
          events
          |> Enum.filter(&(&1.account_id == account_id))

        highest_version =
          account_events
          |> Enum.map(& &1.version)
          |> Enum.max(fn -> 0 end)

        expected_version = highest_version + 1

        cond do
          version < 1 or version > expected_version ->
            error = Ash.Error.Changes.InvalidAttribute.exception(
              field: :version,
              message: "version must be exactly one greater than the current stream version",
              value: version,
              vars: [expected: expected_version]
            )
            Ash.Changeset.add_error(changeset, error)

          version <= highest_version ->
            error = Ash.Error.Changes.InvalidChanges.exception(
              fields: [:account_id, :version],
              message: "has already been taken"
            )
            Ash.Changeset.add_error(changeset, error)

          true ->
            Ash.Changeset.force_change_attribute(changeset, :sequence, highest_sequence + 1)
        end
      end
    end
  end

  defp check_no_such_input(changeset) do
    if Map.has_key?(changeset.params, :sequence) or Map.has_key?(changeset.params, "sequence") do
      Ash.Changeset.add_error(changeset, Ash.Error.Invalid.NoSuchInput.exception(
        resource: changeset.resource,
        action: changeset.action.name,
        input: :sequence,
        inputs: [:account_id, :version, :payload, :recorded_at]
      ))
    else
      changeset
    end
  end
end
