defmodule OrgGuard.Checks.HasCapability do
  @moduledoc """
  A custom simple check to verify if the actor has the specified capability at the relevant org unit.
  """
  use Ash.Policy.SimpleCheck

  @impl true
  def match?(nil, _authorizer, _opts), do: {:ok, false}

  @impl true
  def match?(actor, authorizer, opts) do
    capability = Keyword.fetch!(opts, :capability)

    cond do
      authorizer.changeset ->
        changeset = authorizer.changeset
        org_unit_id =
          case changeset.action.type do
            :create ->
              Ash.Changeset.get_attribute(changeset, :org_unit_id)
            _ ->
              changeset.data.org_unit_id
          end

        if org_unit_id do
          has? = OrgGuard.Access.Resolver.has_capability?(actor, org_unit_id, capability)
          {:ok, has?}
        else
          {:ok, false}
        end

      authorizer.action_input ->
        if authorizer.action.name == :relocate do
          doc_id = authorizer.action_input.arguments[:document_id]
          target_org_unit_id = authorizer.action_input.arguments[:target_org_unit_id]

          case Ash.get(OrgGuard.Access.Document, doc_id, authorize?: false) do
            {:ok, doc} ->
              current_ok = OrgGuard.Access.Resolver.has_capability?(actor, doc.org_unit_id, :relocate)
              target_ok = OrgGuard.Access.Resolver.has_capability?(actor, target_org_unit_id, :relocate)
              {:ok, current_ok and target_ok}
            _ ->
              {:ok, false}
          end
        else
          {:ok, false}
        end

      true ->
        {:ok, false}
    end
  end

  @impl true
  def describe(opts) do
    capability = Keyword.fetch!(opts, :capability)
    "has capability #{capability}"
  end
end
