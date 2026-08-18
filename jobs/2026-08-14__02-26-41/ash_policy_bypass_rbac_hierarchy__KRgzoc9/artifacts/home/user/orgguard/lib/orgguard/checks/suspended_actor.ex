defmodule OrgGuard.Access.Checks.SuspendedActor do
  @moduledoc """
  A simple check to see if the actor is suspended.
  """
  use Ash.Policy.SimpleCheck

  @impl true
  def describe(_opts), do: "actor.status == :suspended"

  @impl true
  def match?(nil, _context, _opts), do: false
  def match?(%{status: :suspended}, _context, _opts), do: true
  def match?(_actor, _context, _opts), do: false
end
