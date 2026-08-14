defmodule OrgGuard.Checks.HasCapability do
  use Ash.Policy.FilterCheck

  defoverridable strict_check: 3

  def describe(opts) do
    "actor has capability #{opts[:capability]}"
  end

  def filter(actor, _authorizer, opts) do
    capability = opts[:capability]
    allowed_ids = OrgGuard.Access.Resolver.allowed_org_units(actor, capability)
    
    # We return an expression filtering on the document's org_unit_id
    expr(org_unit_id in ^allowed_ids)
  end

  # Override strict_check to defer to runtime filtering/checking
  def strict_check(_actor, _authorizer, _opts) do
    {:ok, :unknown}
  end
end
