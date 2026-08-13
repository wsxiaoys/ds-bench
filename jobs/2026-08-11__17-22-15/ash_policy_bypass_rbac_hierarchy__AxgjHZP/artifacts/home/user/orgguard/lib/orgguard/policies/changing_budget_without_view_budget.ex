defmodule OrgGuard.Policy.ChangingBudgetWithoutViewBudget do
  use Ash.Policy.SimpleCheck

  @impl true
  def describe(_opts), do: "changing budget without view_budget capability"

  @impl true
  def match?(nil, _context, _opts), do: true

  @impl true
  def match?(actor, %{changeset: %Ash.Changeset{} = changeset}, _opts) do
    if actor.global_role == :break_glass do
      false
    else
      changing? = Ash.Changeset.changing_attribute?(changeset, :budget_cents)
      if changing? do
        not OrgGuard.Policy.Helper.has_capability?(actor, changeset.data.org_unit_id, :view_budget)
      else
        false
      end
    end
  end

  def match?(_, _, _), do: false
end
