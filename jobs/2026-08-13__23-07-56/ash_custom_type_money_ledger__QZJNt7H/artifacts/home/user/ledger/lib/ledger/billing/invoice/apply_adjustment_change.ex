defmodule Ledger.Billing.Invoice.ApplyAdjustmentChange do
  @moduledoc """
  Change module for applying an adjustment.
  """
  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, _context) do
    case Ash.Changeset.fetch_argument(changeset, :adjustment) do
      {:ok, %Ledger.Money{} = adjustment} ->
        subtotal = Ash.Changeset.get_attribute(changeset, :subtotal)

        if subtotal && adjustment.currency != subtotal.currency do
          error =
            Ash.Error.Changes.InvalidArgument.exception(
              field: :adjustment,
              message: "must use the currency of the subtotal"
            )

          Ash.Changeset.add_error(changeset, error)
        else
          current_adjustments = Ash.Changeset.get_attribute(changeset, :adjustments) || []
          new_adjustments = current_adjustments ++ [adjustment]
          Ash.Changeset.force_change_attribute(changeset, :adjustments, new_adjustments)
        end

      _ ->
        changeset
    end
  end
end
