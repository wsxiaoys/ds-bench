defmodule OrgGuard.Checks.CanUpdateDocument do
  @moduledoc """
  A custom simple check to verify update permissions on Document.
  """
  use Ash.Policy.SimpleCheck

  @impl true
  def match?(nil, _authorizer, _opts), do: {:ok, false}

  @impl true
  def match?(actor, authorizer, _opts) do
    changeset = authorizer.changeset

    if changeset do
      org_unit_id = changeset.data.org_unit_id

      has_write? = OrgGuard.Access.Resolver.has_capability?(actor, org_unit_id, :write)

      changing_budget? = Ash.Changeset.changing_attribute?(changeset, :budget_cents)

      has_view_budget? =
        if changing_budget? do
          OrgGuard.Access.Resolver.has_capability?(actor, org_unit_id, :view_budget)
        else
          true
        end

      {:ok, has_write? and has_view_budget?}
    else
      {:ok, false}
    end
  end

  @impl true
  def describe(_opts), do: "can update document"
end
