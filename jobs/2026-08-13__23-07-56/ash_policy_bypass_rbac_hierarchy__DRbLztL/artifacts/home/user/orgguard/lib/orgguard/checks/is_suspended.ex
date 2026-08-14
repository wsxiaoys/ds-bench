defmodule OrgGuard.Checks.IsSuspended do
  use Ash.Policy.SimpleCheck

  def describe(_opts), do: "actor is suspended"

  def match?(actor, _context, _opts) do
    case actor do
      %OrgGuard.Access.User{status: :suspended} -> true
      _ -> false
    end
  end
end
