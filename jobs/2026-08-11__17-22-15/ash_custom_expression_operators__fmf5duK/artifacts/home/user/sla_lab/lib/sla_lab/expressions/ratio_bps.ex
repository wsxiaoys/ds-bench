defmodule SlaLab.Expressions.RatioBps do
  use Ash.CustomExpression,
    name: :ratio_bps,
    arguments: [
      [:integer, :integer]
    ]

  def expression(data_layer, [numerator, denominator]) when data_layer in [
    Ash.DataLayer.Ets,
    Ash.DataLayer.Simple
  ] do
    {:ok, expr(fragment(&__MODULE__.ratio_bps/2, ^numerator, ^denominator))}
  end

  def expression(_data_layer, _args), do: :unknown

  def ratio_bps(nil, _), do: nil
  def ratio_bps(_, nil), do: nil
  def ratio_bps(_, 0), do: nil
  def ratio_bps(numerator, denominator) do
    val = numerator * 10_000
    q = div(val, denominator)
    r = rem(val, denominator)

    rounded =
      if val >= 0 do
        if r * 2 >= denominator, do: q + 1, else: q
      else
        if r * 2 < -denominator, do: q - 1, else: q
      end

    max(0, min(rounded, 20_000))
  end
end
