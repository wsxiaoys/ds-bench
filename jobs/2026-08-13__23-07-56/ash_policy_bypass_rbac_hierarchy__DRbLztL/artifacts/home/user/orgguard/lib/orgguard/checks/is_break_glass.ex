defmodule OrgGuard.Checks.IsBreakGlass do
  use Ash.Policy.SimpleCheck

  def describe(_opts), do: "actor has global_role break_glass"

  def match?(actor, _context, _opts) do
    case actor do
      %OrgGuard.Access.User{global_role: :break_glass} -> true
      _ -> false
    end
  end
end
