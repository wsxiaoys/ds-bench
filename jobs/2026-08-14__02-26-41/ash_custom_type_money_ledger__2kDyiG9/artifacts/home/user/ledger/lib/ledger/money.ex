defmodule Ledger.Money do
  @moduledoc """
  A first-class money value represented as an exact integer of minor units.
  """
  @enforce_keys [:currency, :amount]
  defstruct [:currency, :amount]

  @currencies [:bhd, :eur, :jpy, :usd]

  def currencies, do: @currencies

  def exponent(:bhd), do: 3
  def exponent(:eur), do: 2
  def exponent(:jpy), do: 0
  def exponent(:usd), do: 2
  def exponent(other) do
    raise ArgumentError, "Unknown currency: #{inspect(other)}"
  end

  def new(amount, currency) do
    case normalize_currency(currency) do
      {:ok, norm_currency} ->
        if is_integer(amount) do
          {:ok, %__MODULE__{amount: amount, currency: norm_currency}}
        else
          {:error, :invalid_amount}
        end
      :error ->
        {:error, :unknown_currency}
    end
  end

  def new!(amount, currency) do
    case new(amount, currency) do
      {:ok, money} -> money
      {:error, reason} -> raise ArgumentError, "Invalid money: #{inspect(reason)}"
    end
  end

  def zero(currency) do
    new!(0, currency)
  end

  def add(%__MODULE__{currency: c, amount: a1}, %__MODULE__{currency: c, amount: a2}) do
    {:ok, %__MODULE__{currency: c, amount: a1 + a2}}
  end
  def add(%__MODULE__{}, %__MODULE__{}) do
    {:error, :currency_mismatch}
  end

  def subtract(%__MODULE__{currency: c, amount: a1}, %__MODULE__{currency: c, amount: a2}) do
    {:ok, %__MODULE__{currency: c, amount: a1 - a2}}
  end
  def subtract(%__MODULE__{}, %__MODULE__{}) do
    {:error, :currency_mismatch}
  end

  def multiply(%__MODULE__{currency: c, amount: a}, factor) when is_integer(factor) do
    {:ok, %__MODULE__{currency: c, amount: a * factor}}
  end
  def multiply(%__MODULE__{}, _factor) do
    {:error, :invalid_factor}
  end

  def sum(list, currency) when is_list(list) do
    case normalize_currency(currency) do
      {:ok, norm_currency} ->
        Enum.reduce_while(list, {:ok, 0}, fn
          %__MODULE__{currency: ^norm_currency, amount: amount}, {:ok, acc} ->
            {:cont, {:ok, acc + amount}}
          _, _ ->
            {:halt, {:error, :currency_mismatch}}
        end)
        |> case do
          {:ok, total_amount} -> {:ok, %__MODULE__{currency: norm_currency, amount: total_amount}}
          {:error, :currency_mismatch} -> {:error, :currency_mismatch}
        end
      :error ->
        {:error, :currency_mismatch}
    end
  end

  def compare(%__MODULE__{currency: c, amount: a1}, %__MODULE__{currency: c, amount: a2}) do
    cond do
      a1 < a2 -> :lt
      a1 == a2 -> :eq
      a1 > a2 -> :gt
    end
  end
  def compare(%__MODULE__{}, %__MODULE__{}) do
    raise ArgumentError, "cannot compare money in different currencies"
  end

  def to_string(%__MODULE__{currency: currency, amount: amount}) do
    code = currency |> Atom.to_string() |> String.upcase()
    exp = exponent(currency)
    if exp == 0 do
      "#{code} #{amount}"
    else
      abs_amount = abs(amount)
      div_val = div(abs_amount, pow10(exp))
      rem_val = rem(abs_amount, pow10(exp))
      rem_str = rem_val |> Integer.to_string() |> String.pad_leading(exp, "0")
      sign = if amount < 0, do: "-", else: ""
      "#{code} #{sign}#{div_val}.#{rem_str}"
    end
  end

  defp pow10(0), do: 1
  defp pow10(1), do: 10
  defp pow10(2), do: 100
  defp pow10(3), do: 1000

  defp normalize_currency(:bhd), do: {:ok, :bhd}
  defp normalize_currency(:eur), do: {:ok, :eur}
  defp normalize_currency(:jpy), do: {:ok, :jpy}
  defp normalize_currency(:usd), do: {:ok, :usd}
  defp normalize_currency("bhd"), do: {:ok, :bhd}
  defp normalize_currency("BHD"), do: {:ok, :bhd}
  defp normalize_currency("eur"), do: {:ok, :eur}
  defp normalize_currency("EUR"), do: {:ok, :eur}
  defp normalize_currency("jpy"), do: {:ok, :jpy}
  defp normalize_currency("JPY"), do: {:ok, :jpy}
  defp normalize_currency("usd"), do: {:ok, :usd}
  defp normalize_currency("USD"), do: {:ok, :usd}
  defp normalize_currency(_), do: :error
end

defimpl String.Chars, for: Ledger.Money do
  def to_string(money), do: Ledger.Money.to_string(money)
end
