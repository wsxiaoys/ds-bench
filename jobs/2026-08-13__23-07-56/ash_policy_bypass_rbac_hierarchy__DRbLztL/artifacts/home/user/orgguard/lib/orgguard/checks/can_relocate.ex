defmodule OrgGuard.Checks.CanRelocate do
  use Ash.Policy.SimpleCheck

  def describe(_opts), do: "actor has relocate capability at both current and target org units"

  def match?(actor, context, _opts) do
    args =
      cond do
        Map.has_key?(context, :changeset) && context.changeset ->
          context.changeset.arguments
        Map.has_key?(context, :query) && context.query ->
          context.query.arguments
        Map.has_key?(context, :action_input) && context.action_input ->
          context.action_input.arguments
        true ->
          %{}
      end

    document_id = Map.get(args, :document_id)
    target_org_unit_id = Map.get(args, :target_org_unit_id)

    if is_nil(actor) or is_nil(document_id) or is_nil(target_org_unit_id) do
      false
    else
      case Ash.get(OrgGuard.Access.Document, document_id, authorize?: false) do
        {:ok, document} ->
          allowed_current = OrgGuard.Access.Resolver.allowed_org_units(actor, :relocate)
          allowed_target = OrgGuard.Access.Resolver.allowed_org_units(actor, :relocate)

          document.org_unit_id in allowed_current and target_org_unit_id in allowed_target

        _ ->
          false
      end
    end
  end
end
