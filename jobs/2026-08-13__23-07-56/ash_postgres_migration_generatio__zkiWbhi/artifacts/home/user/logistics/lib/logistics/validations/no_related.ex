defmodule Logistics.Validations.NoRelated do
  use Ash.Resource.Validation

  @impl true
  def validate(changeset, opts, _context) do
    relationship = opts[:relationship]
    message = opts[:message]
    field = opts[:field] || relationship

    record = changeset.data
    domain = changeset.domain
    relationship_info = changeset.resource |> Ash.Resource.Info.relationship(relationship)
    related_resource = relationship_info.destination
    foreign_key = relationship_info.destination_attribute

    # Check if any related record exists
    exists? =
      related_resource
      |> Ash.Query.filter(^ref(foreign_key) == ^record.id)
      |> Ash.Query.limit(1)
      |> Ash.read_one!(domain: domain)
      |> case do
        nil -> false
        _ -> true
      end

    if exists? do
      {:error, Ash.Error.Changes.InvalidAttribute.exception(
        field: field,
        message: message
      )}
    else
      :ok
    end
  end

  @impl true
  def supports(_opts), do: [Ash.Changeset]
end
