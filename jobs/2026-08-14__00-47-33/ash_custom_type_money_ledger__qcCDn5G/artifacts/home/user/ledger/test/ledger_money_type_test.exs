defmodule Ledger.Money.TypeTest do
  use ExUnit.Case, async: true
  alias Ledger.Money
  alias Ledger.Money.Type

  test "cast_input/2 nil" do
    assert {:ok, nil} = Ash.Type.cast_input(Type, nil)
  end

  test "cast_input/2 Ledger.Money struct" do
    money = Money.new!(100, :usd)
    assert {:ok, ^money} = Ash.Type.cast_input(Type, money)
  end

  test "cast_input/2 map with atom keys" do
    assert {:ok, %Money{amount: 100, currency: :usd}} = Ash.Type.cast_input(Type, %{currency: :usd, amount: 100})
    assert {:ok, %Money{amount: 100, currency: :usd}} = Ash.Type.cast_input(Type, %{currency: "usd", amount: 100})
    assert {:ok, %Money{amount: 100, currency: :usd}} = Ash.Type.cast_input(Type, %{currency: "USD", amount: "100"})
  end

  test "cast_input/2 map with string keys" do
    assert {:ok, %Money{amount: 100, currency: :usd}} = Ash.Type.cast_input(Type, %{"currency" => "USD", "amount" => "100"})
  end

  test "cast_input/2 map missing keys" do
    assert {:error, [message: "invalid money format", reason: :invalid_format]} = Ash.Type.cast_input(Type, %{currency: :usd})
    assert {:error, [message: "invalid money format", reason: :invalid_format]} = Ash.Type.cast_input(Type, %{amount: 100})
  end

  test "cast_input/2 canonical string" do
    assert {:ok, %Money{amount: 1250, currency: :usd}} = Ash.Type.cast_input(Type, "USD 12.50")
    assert {:ok, %Money{amount: -5, currency: :usd}} = Ash.Type.cast_input(Type, "USD -0.05")
    assert {:ok, %Money{amount: 500, currency: :jpy}} = Ash.Type.cast_input(Type, "JPY 500")
  end

  test "cast_input/2 currency resolution order before amount" do
    # Currency is unsupported, so report currency error even if amount is unusable
    assert {:error, [message: "unknown currency", reason: :unknown_currency, currency: "INVALID"]} =
             Ash.Type.cast_input(Type, %{currency: "INVALID", amount: 12.50})

    assert {:error, [message: "unknown currency", reason: :unknown_currency, currency: "INVALID"]} =
             Ash.Type.cast_input(Type, %{"currency" => "INVALID", "amount" => "abc"})

    assert {:error, [message: "unknown currency", reason: :unknown_currency, currency: "INVALID"]} =
             Ash.Type.cast_input(Type, "INVALID 12.50")
  end

  test "cast_input/2 fractional minor units error" do
    assert {:error, [message: "amount must be a whole number of minor units", reason: :fractional_minor_units]} =
             Ash.Type.cast_input(Type, %{currency: :usd, amount: 12.50})

    assert {:error, [message: "amount must be a whole number of minor units", reason: :fractional_minor_units]} =
             Ash.Type.cast_input(Type, %{currency: :usd, amount: "12.50"})
  end

  test "cast_input/2 invalid format error" do
    assert {:error, [message: "invalid money format", reason: :invalid_format]} =
             Ash.Type.cast_input(Type, "USD 12.5") # incorrect decimal digits

    assert {:error, [message: "invalid money format", reason: :invalid_format]} =
             Ash.Type.cast_input(Type, "USD 12") # missing decimal point for USD

    assert {:error, [message: "invalid money format", reason: :invalid_format]} =
             Ash.Type.cast_input(Type, "JPY 500.00") # decimal point not allowed for JPY
  end

  test "cast_stored/2 and dump_to_native/2 round-trip" do
    money = Money.new!(1250, :usd)
    assert {:ok, stored} = Ash.Type.dump_to_native(Type, money)
    assert stored == %{"currency" => "usd", "amount" => 1250}

    # Stored form must round-trip losslessly
    assert {:ok, loaded} = Ash.Type.cast_stored(Type, stored)
    assert loaded == money

    # Stored form must round-trip losslessly after being encoded and decoded with Jason
    {:ok, json} = Jason.encode(stored)
    {:ok, decoded} = Jason.decode(json)
    assert {:ok, loaded_from_json} = Ash.Type.cast_stored(Type, decoded)
    assert loaded_from_json == money
  end

  test "apply_constraints/2 :currencies" do
    money_usd = Money.new!(100, :usd)
    money_eur = Money.new!(100, :eur)

    assert {:ok, ^money_usd} = Ash.Type.apply_constraints(Type, money_usd, [currencies: [:usd, :jpy]])
    assert {:error, [message: "currency is not allowed", reason: :currency_not_allowed, currency: :eur]} =
             Ash.Type.apply_constraints(Type, money_eur, [currencies: [:usd, :jpy]])
  end

  test "apply_constraints/2 :multiple_of" do
    m1 = Money.new!(100, :usd)
    m2 = Money.new!(103, :usd)

    assert {:ok, ^m1} = Ash.Type.apply_constraints(Type, m1, [multiple_of: 5])
    assert {:error, [message: "must be a multiple of %{multiple_of} minor units", reason: :not_multiple_of, multiple_of: 5]} =
             Ash.Type.apply_constraints(Type, m2, [multiple_of: 5])
  end

  test "apply_constraints/2 :min and :max" do
    m = Money.new!(1000, :usd)

    # Within bounds
    assert {:ok, ^m} = Ash.Type.apply_constraints(Type, m, [min: "USD 5.00", max: "USD 15.00"])

    # Below min
    assert {:error, [message: "must be greater than or equal to %{min}", reason: :below_min, min: "USD 15.00"]} =
             Ash.Type.apply_constraints(Type, m, [min: "USD 15.00"])

    # Above max
    assert {:error, [message: "must be less than or equal to %{max}", reason: :above_max, max: "USD 5.00"]} =
             Ash.Type.apply_constraints(Type, m, [max: "USD 5.00"])

    # Currency mismatch
    assert {:error, [message: "cannot compare money in different currencies", reason: :currency_mismatch]} =
             Ash.Type.apply_constraints(Type, m, [min: "EUR 5.00"])
  end

  test "NewType Ledger.Money.Usd constraints" do
    money_usd_ok = Money.new!(500, :usd)
    money_usd_low = Money.new!(-100, :usd)
    money_usd_high = Money.new!(1200000, :usd)
    money_eur = Money.new!(100, :eur)

    assert {:ok, ^money_usd_ok} = Ash.Type.cast_input(Ledger.Money.Usd, money_usd_ok)

    # Out of bounds
    assert {:error, [message: "must be greater than or equal to %{min}", reason: :below_min, min: "USD 0.00"]} =
             Ash.Type.cast_input(Ledger.Money.Usd, money_usd_low)

    assert {:error, [message: "must be less than or equal to %{max}", reason: :above_max, max: "USD 10000.00"]} =
             Ash.Type.cast_input(Ledger.Money.Usd, money_usd_high)

    # Disallowed currency
    assert {:error, [message: "currency is not allowed", reason: :currency_not_allowed, currency: :eur]} =
             Ash.Type.cast_input(Ledger.Money.Usd, money_eur)
  end
end
