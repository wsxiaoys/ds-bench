defmodule OrgGuard.Policy.CanRelocate do
  use Ash.Policy.SimpleCheck

  @impl true
  def describe(_opts), do: "can relocate document"

  @impl true
  def match?(nil, _context, _opts), do: false

  @impl true
  def match?(actor, %{action_input: %Ash.ActionInput{} = input}, _opts) do
    if actor.global_role == :break_glass do
      true
    else
      document_id = input.arguments[:document_id]
      target_org_unit_id = input.arguments[:target_org_unit_id]

      case OrgGuard.Access.get_document(document_id, authorize?: false) do
        {:ok, document} ->
          current_ok = OrgGuard.Policy.Helper.has_capability?(actor, document.org_unit_id, :relocate)
          target_ok = OrgGuard.Policy.Helper.has_capability?(actor, target_org_unit_id, :relocate)
          current_ok and target_ok

        _ ->
          false
      end
    end
  end

  def match?(_, _, _), do: false
end
