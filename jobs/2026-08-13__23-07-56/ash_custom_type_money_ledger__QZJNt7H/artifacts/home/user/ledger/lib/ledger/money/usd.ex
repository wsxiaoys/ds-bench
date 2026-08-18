defmodule Ledger.Money.Usd do
  @moduledoc """
  A narrowed money type restricted to USD.
  """
  use Ash.Type.NewType,
    subtype_of: Ledger.Money.Type,
    constraints: [
      currencies: [:usd],
      min: "USD 0.00",
      max: "USD 10000.00"
    ]
end
