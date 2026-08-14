defmodule OrgGuard.Access.Checks.CanRelocate do
  @moduledoc """
  A simple check to authorize the relocate action.
  """
  use Ash.Policy.SimpleCheck

  @impl true
  def describe(_opts), do: "actor can relocate document"

  @impl true
  def match?(nil, _context, _opts), do: false

  def match?(actor, context, _opts) do
    action_input = Map.get(context, :action_input)

    if action_input do
      document_id = action_input.arguments.document_id
      target_org_unit_id = action_input.arguments.target_org_unit_id

      case OrgGuard.Access.get_document(document_id, authorize?: false) do
        {:ok, document} ->
          current_org_unit_id = document.org_unit_id

          authorized_org_unit_ids =
            OrgGuard.Access.RBAC.get_authorized_org_unit_ids(actor, :relocate)

          current_org_unit_id in authorized_org_unit_ids and
            target_org_unit_id in authorized_org_unit_ids

        _ ->
          false
      end
    else
      false
    end
  end
end
