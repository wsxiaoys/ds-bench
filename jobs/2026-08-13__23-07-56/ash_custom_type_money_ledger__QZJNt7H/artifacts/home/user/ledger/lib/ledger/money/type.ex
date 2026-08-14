defmodule Ledger.Money.Type do
  @moduledoc """
  An Ash.Type representing Ledger.Money.
  """
  use Ash.Type

  @constraints [
    currencies: [
      type: {:list, :atom},
      doc: "The list of currency atoms that are allowed"
    ],
    min: [
      type: :any,
      doc: "Inclusive minimum bound"
    ],
    max: [
      type: :any,
      doc: "Inclusive maximum bound"
    ],
    multiple_of: [
      type: :pos_integer,
      doc: "The amount must be an exact multiple of this positive integer"
    ]
  ]

  @impl true
  def storage_type(_), do: :map

  @impl true
  def constraints, do: @constraints

  @impl true
  def matches_type?(%Ledger.Money{}, _), do: true
  @impl true
  def matches_type?(_, _), do: false

  @impl true
  def cast_input(nil, _), do: {:ok, nil}

  @impl true
  def cast_input(%Ledger.Money{} = money, _), do: {:ok, money}

  @impl true
  def cast_input(map, _) when is_map(map) do
    case extract_map_fields(map) do
      {:ok, currency_val, amount_val} ->
        case resolve_currency(currency_val) do
          {:ok, currency} ->
            case parse_map_amount(amount_val) do
              {:ok, amount} ->
                {:ok, %Ledger.Money{currency: currency, amount: amount}}

              {:error, err} ->
                {:error, err}
            end

          {:error, err} ->
            {:error, err}
        end

      {:error, err} ->
        {:error, err}
    end
  end

  @impl true
  def cast_input(str, _) when is_binary(str) do
    case String.split(str, " ") do
      [code_str, amount_str] ->
        case resolve_currency(code_str) do
          {:ok, currency} ->
            exp = Ledger.Money.exponent(currency)

            case parse_canonical_amount(amount_str, exp) do
              {:ok, amount} ->
                {:ok, %Ledger.Money{currency: currency, amount: amount}}

              {:error, err} ->
                {:error, err}
            end

          {:error, err} ->
            {:error, err}
        end

      _ ->
        {:error, [message: "invalid money format", reason: :invalid_format]}
    end
  end

  @impl true
  def cast_input(_, _) do
    {:error, [message: "invalid money format", reason: :invalid_format]}
  end

  @impl true
  def cast_stored(nil, _), do: {:ok, nil}

  @impl true
  def cast_stored(%{"currency" => currency_str, "amount" => amount_int}, _)
      when is_binary(currency_str) and is_integer(amount_int) do
    case resolve_currency(currency_str) do
      {:ok, currency} ->
        {:ok, %Ledger.Money{currency: currency, amount: amount_int}}

      _ ->
        {:error, [message: "invalid money format", reason: :invalid_format]}
    end
  end

  @impl true
  def cast_stored(_, _) do
    {:error, [message: "invalid money format", reason: :invalid_format]}
  end

  @impl true
  def dump_to_native(nil, _), do: {:ok, nil}

  @impl true
  def dump_to_native(%Ledger.Money{} = money, _) do
    {:ok, %{"currency" => Atom.to_string(money.currency), "amount" => money.amount}}
  end

  @impl true
  def dump_to_native(_, _), do: :error

  @impl true
  def equal?(nil, nil), do: true
  @impl true
  def equal?(%Ledger.Money{currency: c, amount: a}, %Ledger.Money{currency: c, amount: a}),
    do: true

  @impl true
  def equal?(_, _), do: false

  @impl true
  def apply_constraints(nil, _), do: :ok

  @impl true
  def apply_constraints(%Ledger.Money{} = value, constraints) do
    with :ok <- check_currencies_constraint(value, constraints[:currencies]),
         :ok <- check_multiple_of_constraint(value, constraints[:multiple_of]),
         :ok <- check_min_constraint(value, constraints[:min]),
         :ok <- check_max_constraint(value, constraints[:max]) do
      {:ok, value}
    else
      {:error, keyword} -> {:error, keyword}
    end
  end

  # Helper functions

  defp extract_map_fields(map) do
    cond do
      Map.has_key?(map, :currency) and Map.has_key?(map, :amount) ->
        {:ok, Map.get(map, :currency), Map.get(map, :amount)}

      Map.has_key?(map, "currency") and Map.has_key?(map, "amount") ->
        {:ok, Map.get(map, "currency"), Map.get(map, "amount")}

      true ->
        {:error, [message: "invalid money format", reason: :invalid_format]}
    end
  end

  defp resolve_currency(currency_val) do
    cond do
      is_atom(currency_val) ->
        if currency_val in [:bhd, :eur, :jpy, :usd] do
          {:ok, currency_val}
        else
          {:error,
           [message: "unknown currency", reason: :unknown_currency, currency: currency_val]}
        end

      is_binary(currency_val) ->
        upcased = String.upcase(currency_val)

        case upcased do
          "BHD" ->
            {:ok, :bhd}

          "EUR" ->
            {:ok, :eur}

          "JPY" ->
            {:ok, :jpy}

          "USD" ->
            {:ok, :usd}

          _ ->
            {:error,
             [message: "unknown currency", reason: :unknown_currency, currency: currency_val]}
        end

      true ->
        {:error, [message: "unknown currency", reason: :unknown_currency, currency: currency_val]}
    end
  end

  defp parse_map_amount(amount_val) do
    cond do
      is_integer(amount_val) ->
        {:ok, amount_val}

      is_float(amount_val) ->
        {:error,
         [
           message: "amount must be a whole number of minor units",
           reason: :fractional_minor_units
         ]}

      is_binary(amount_val) ->
        cond do
          amount_val =~ ~r/^-?[0-9]+$/ ->
            {:ok, String.to_integer(amount_val)}

          amount_val =~ ~r/^-?[0-9]+\.[0-9]+$/ ->
            {:error,
             [
               message: "amount must be a whole number of minor units",
               reason: :fractional_minor_units
             ]}

          true ->
            {:error, [message: "invalid money format", reason: :invalid_format]}
        end

      true ->
        {:error, [message: "invalid money format", reason: :invalid_format]}
    end
  end

  defp parse_canonical_amount(amount_str, 0) do
    if amount_str =~ ~r/^-?[0-9]+$/ do
      {:ok, String.to_integer(amount_str)}
    else
      {:error, [message: "invalid money format", reason: :invalid_format]}
    end
  end

  defp parse_canonical_amount(amount_str, exp) do
    if amount_str =~ ~r/^-?[0-9]+\.[0-9]{#{exp}}$/ do
      amount = String.replace(amount_str, ".", "") |> String.to_integer()
      {:ok, amount}
    else
      {:error, [message: "invalid money format", reason: :invalid_format]}
    end
  end

  defp check_currencies_constraint(value, allowed_currencies) do
    if is_list(allowed_currencies) and value.currency not in allowed_currencies do
      {:error,
       [
         message: "currency is not allowed",
         reason: :currency_not_allowed,
         currency: value.currency
       ]}
    else
      :ok
    end
  end

  defp check_multiple_of_constraint(value, multiple_of) do
    if is_integer(multiple_of) and rem(value.amount, multiple_of) != 0 do
      {:error,
       [
         message: "must be a multiple of %{multiple_of} minor units",
         reason: :not_multiple_of,
         multiple_of: multiple_of
       ]}
    else
      :ok
    end
  end

  defp check_min_constraint(_value, nil), do: :ok

  defp check_min_constraint(value, min_bound) do
    case cast_bound(min_bound) do
      {:ok, bound} ->
        if value.currency != bound.currency do
          {:error,
           [message: "cannot compare money in different currencies", reason: :currency_mismatch]}
        else
          if value.amount < bound.amount do
            {:error,
             [
               message: "must be greater than or equal to %{min}",
               reason: :below_min,
               min: Ledger.Money.to_string(bound)
             ]}
          else
            :ok
          end
        end

      _ ->
        :ok
    end
  end

  defp check_max_constraint(_value, nil), do: :ok

  defp check_max_constraint(value, max_bound) do
    case cast_bound(max_bound) do
      {:ok, bound} ->
        if value.currency != bound.currency do
          {:error,
           [message: "cannot compare money in different currencies", reason: :currency_mismatch]}
        else
          if value.amount > bound.amount do
            {:error,
             [
               message: "must be less than or equal to %{max}",
               reason: :above_max,
               max: Ledger.Money.to_string(bound)
             ]}
          else
            :ok
          end
        end

      _ ->
        :ok
    end
  end

  defp cast_bound(bound) do
    case cast_input(bound, []) do
      {:ok, %Ledger.Money{} = money} -> {:ok, money}
      _ -> :error
    end
  end
end
