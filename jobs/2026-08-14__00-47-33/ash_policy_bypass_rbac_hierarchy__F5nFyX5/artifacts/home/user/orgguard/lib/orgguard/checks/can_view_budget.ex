defmodule OrgGuard.Checks.CanViewBudget do
  @moduledoc """
  A custom filter check to restrict Document budget viewing based on the actor's view_budget capability.
  """
  use Ash.Policy.FilterCheck

  @impl true
  def filter(nil, _context, _opts) do
    Ash.Expr.expr(org_unit_id == "00000000-0000-0000-0000-000000000000")
  end

  @impl true
  def filter(actor, _context, _opts) do
    all_org_units = Ash.read!(OrgGuard.Access.OrgUnit, authorize?: false)

    allowed_ids =
      all_org_units
      |> Enum.filter(fn org_unit ->
        OrgGuard.Access.Resolver.has_capability?(actor, org_unit.id, :view_budget)
      end)
      |> Enum.map(& &1.id)

    if allowed_ids == [] do
      Ash.Expr.expr(org_unit_id == "00000000-0000-0000-0000-000000000000")
    else
      Ash.Expr.expr(org_unit_id in ^allowed_ids)
    end
  end

  @impl true
  def describe(_opts), do: "can view budget"
end
