defmodule Ledger.Billing.Invoice.ValidateAdjustmentsCurrency do
  @moduledoc """
  Validation module to ensure all adjustments use the currency of the subtotal.
  """
  use Ash.Resource.Validation

  @impl true
  def validate(changeset, _opts, _context) do
    subtotal = Ash.Changeset.get_attribute(changeset, :subtotal)
    adjustments = Ash.Changeset.get_attribute(changeset, :adjustments) || []

    if is_nil(subtotal) do
      :ok
    else
      mismatch? = Enum.any?(adjustments, fn adj -> adj.currency != subtotal.currency end)

      if mismatch? do
        {:error,
         Ash.Error.Changes.InvalidAttribute.exception(
           field: :adjustments,
           message: "must all use the currency of the subtotal"
         )}
      else
        :ok
      end
    end
  end
end
