defmodule OrgGuard.Checks.CanCreate do
  use Ash.Policy.SimpleCheck

  def describe(_opts), do: "actor has write capability on the target org unit"

  def match?(actor, %{changeset: changeset}, _opts) do
    if is_nil(actor) or is_nil(changeset) do
      false
    else
      org_unit_id = Ash.Changeset.get_attribute(changeset, :org_unit_id)
      if is_nil(org_unit_id) do
        false
      else
        allowed_ids = OrgGuard.Access.Resolver.allowed_org_units(actor, :write)
        org_unit_id in allowed_ids
      end
    end
  end

  def match?(_, _, _), do: false
end
