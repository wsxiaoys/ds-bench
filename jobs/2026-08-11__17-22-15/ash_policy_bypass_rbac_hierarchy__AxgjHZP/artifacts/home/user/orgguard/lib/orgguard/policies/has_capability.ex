defmodule OrgGuard.Policy.HasCapability do
  use Ash.Policy.SimpleCheck

  @impl true
  def describe(opts), do: "has capability #{opts[:capability]}"

  @impl true
  def match?(nil, _context, _opts), do: false

  @impl true
  def match?(actor, context, opts) do
    capability = Keyword.fetch!(opts, :capability)
    org_unit_id = get_org_unit_id(context)

    if org_unit_id do
      OrgGuard.Policy.Helper.has_capability?(actor, org_unit_id, capability)
    else
      false
    end
  end

  defp get_org_unit_id(%{changeset: %Ash.Changeset{action_type: :create} = changeset}) do
    Ash.Changeset.get_attribute(changeset, :org_unit_id)
  end

  defp get_org_unit_id(%{changeset: %Ash.Changeset{data: document}}) do
    document.org_unit_id
  end

  defp get_org_unit_id(%{query: _query}) do
    nil
  end

  defp get_org_unit_id(_) do
    nil
  end
end
