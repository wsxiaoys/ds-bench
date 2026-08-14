defmodule Ledger.MoneyTest do
  use ExUnit.Case, async: true
  alias Ledger.Money

  test "currencies/0" do
    assert Money.currencies() == [:bhd, :eur, :jpy, :usd]
  end

  test "exponent/1" do
    assert Money.exponent(:bhd) == 3
    assert Money.exponent(:eur) == 2
    assert Money.exponent(:jpy) == 0
    assert Money.exponent(:usd) == 2
  end

  test "new/2 and new!/2" do
    assert {:ok, %Money{amount: 100, currency: :usd}} = Money.new(100, :usd)
    assert {:error, :invalid_amount} = Money.new("100", :usd)
    assert {:error, :unknown_currency} = Money.new(100, :invalid)

    # Resolution order: currency before amount
    assert {:error, :unknown_currency} = Money.new("100", :invalid)

    assert %Money{amount: 100, currency: :usd} = Money.new!(100, :usd)
    assert_raise ArgumentError, fn -> Money.new!("100", :usd) end
    assert_raise ArgumentError, fn -> Money.new!(100, :invalid) end
  end

  test "zero/1" do
    assert %Money{amount: 0, currency: :usd} = Money.zero(:usd)
    assert %Money{amount: 0, currency: :jpy} = Money.zero(:jpy)
    assert_raise ArgumentError, fn -> Money.zero(:invalid) end
  end

  test "add/2 and subtract/2" do
    m1 = Money.new!(100, :usd)
    m2 = Money.new!(50, :usd)
    m3 = Money.new!(100, :eur)

    assert {:ok, %Money{amount: 150, currency: :usd}} = Money.add(m1, m2)
    assert {:ok, %Money{amount: 50, currency: :usd}} = Money.subtract(m1, m2)

    assert {:error, :currency_mismatch} = Money.add(m1, m3)
    assert {:error, :currency_mismatch} = Money.subtract(m1, m3)
  end

  test "multiply/2" do
    m = Money.new!(100, :usd)
    assert {:ok, %Money{amount: 300, currency: :usd}} = Money.multiply(m, 3)
    assert {:error, :invalid_factor} = Money.multiply(m, 2.5)
  end

  test "sum/2" do
    list = [Money.new!(100, :usd), Money.new!(200, :usd)]
    assert {:ok, %Money{amount: 300, currency: :usd}} = Money.sum(list, :usd)
    assert {:ok, %Money{amount: 0, currency: :usd}} = Money.sum([], :usd)

    # Currency mismatch in list
    mixed_list = [Money.new!(100, :usd), Money.new!(100, :eur)]
    assert {:error, :currency_mismatch} = Money.sum(mixed_list, :usd)
  end

  test "compare/2" do
    m1 = Money.new!(100, :usd)
    m2 = Money.new!(200, :usd)
    m3 = Money.new!(100, :eur)

    assert Money.compare(m1, m2) == :lt
    assert Money.compare(m2, m1) == :gt
    assert Money.compare(m1, m1) == :eq

    assert_raise ArgumentError, fn -> Money.compare(m1, m3) end
  end

  test "to_string/1" do
    assert to_string(Money.new!(1250, :usd)) == "USD 12.50"
    assert to_string(Money.new!(-5, :usd)) == "USD -0.05"
    assert to_string(Money.new!(0, :usd)) == "USD 0.00"
    assert to_string(Money.new!(500, :jpy)) == "JPY 500"
    assert to_string(Money.new!(-7, :jpy)) == "JPY -7"
    assert to_string(Money.new!(1234, :bhd)) == "BHD 1.234"
    assert to_string(Money.new!(-1, :bhd)) == "BHD -0.001"
  end
end
