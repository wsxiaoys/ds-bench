defmodule Vault.Ledger.Changes.AppendEvent do
  use Ash.Resource.Change
  require Ash.Query

  def change(changeset, _opts, _context) do
    account_id = Ash.Changeset.get_attribute(changeset, :account_id)
    version = Ash.Changeset.get_attribute(changeset, :version)

    if account_id && version do
      highest_version = get_highest_version(account_id)

      cond do
        version < 1 or version > highest_version + 1 ->
          expected = highest_version + 1
          error = Ash.Error.Changes.InvalidAttribute.exception(
            field: :version,
            message: "version must be exactly one greater than the current stream version",
            vars: [expected: expected]
          )
          Ash.Changeset.add_error(changeset, error)

        true ->
          Ash.Changeset.before_action(changeset, fn changeset ->
            highest_sequence = get_highest_sequence()
            Ash.Changeset.force_change_attribute(changeset, :sequence, highest_sequence + 1)
          end)
      end
    else
      changeset
    end
  end

  defp get_highest_version(account_id) do
    Vault.Ledger.Event
    |> Ash.Query.filter(account_id == ^account_id)
    |> Ash.Query.sort(version: :desc)
    |> Ash.Query.limit(1)
    |> Ash.read_one!(authorize?: false)
    |> case do
      nil -> 0
      event -> event.version
    end
  end

  defp get_highest_sequence() do
    Vault.Ledger.Event
    |> Ash.Query.sort(sequence: :desc)
    |> Ash.Query.limit(1)
    |> Ash.read_one!(authorize?: false)
    |> case do
      nil -> 0
      event -> event.sequence
    end
  end
end
