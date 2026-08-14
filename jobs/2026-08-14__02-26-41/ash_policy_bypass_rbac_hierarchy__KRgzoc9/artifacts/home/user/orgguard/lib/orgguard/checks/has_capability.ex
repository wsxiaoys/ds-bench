defmodule OrgGuard.Access.Checks.HasCapability do
  @moduledoc """
  A filter check that filters documents based on whether the actor has the required capability.
  """
  use Ash.Policy.FilterCheck

  @impl true
  def describe(opts) do
    "actor has capability #{inspect(opts[:capability])}"
  end

  @impl true
  def filter(actor, _context, opts) do
    capability = opts[:capability]
    authorized_ids = OrgGuard.Access.RBAC.get_authorized_org_unit_ids(actor, capability)
    expr(org_unit_id in ^authorized_ids)
  end
end
