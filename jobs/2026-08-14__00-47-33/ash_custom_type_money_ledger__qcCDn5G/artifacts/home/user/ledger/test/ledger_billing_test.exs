defmodule Ledger.BillingTest do
  use ExUnit.Case, async: true
  import Ash.Query
  alias Ledger.Money
  alias Ledger.Billing
  alias Ledger.Billing.Invoice

  setup do
    :ok
  end

  test "issue_invoice/1 and issue_invoice!/1 with valid USD subtotal" do
    subtotal = Money.new!(1000, :usd)
    adjustments = [Money.new!(50, :usd), Money.new!(-10, :usd)]
    credit_limit = Money.new!(5000, :usd)

    assert {:ok, invoice} = Billing.issue_invoice(%{
      reference: "INV-001",
      subtotal: subtotal,
      adjustments: adjustments,
      credit_limit: credit_limit
    })

    assert invoice.reference == "INV-001"
    assert invoice.subtotal == subtotal
    assert invoice.adjustments == adjustments
    assert invoice.credit_limit == credit_limit
  end

  test "issue_invoice/1 restricts subtotal currency" do
    subtotal = Money.new!(1000, :bhd)
    assert {:error, _error} = Billing.issue_invoice(%{
      reference: "INV-002",
      subtotal: subtotal
    })
  end

  test "issue_invoice/1 restricts adjustments to multiples of 5" do
    subtotal = Money.new!(1000, :usd)
    adjustments_invalid = [Money.new!(3, :usd)]

    assert {:error, _error} = Billing.issue_invoice(%{
      reference: "INV-003",
      subtotal: subtotal,
      adjustments: adjustments_invalid
    })
  end

  test "issue_invoice/1 validates that adjustments use the subtotal's currency" do
    subtotal = Money.new!(1000, :usd)
    adjustments_invalid = [Money.new!(5, :eur)]

    assert {:error, error} = Billing.issue_invoice(%{
      reference: "INV-004",
      subtotal: subtotal,
      adjustments: adjustments_invalid
    })

    assert [invalid_attr_error] = error.errors
    assert invalid_attr_error.field == :adjustments
    assert invalid_attr_error.message == "must all use the currency of the subtotal"
  end

  test "apply_adjustment/2 appends adjustment and validates currency" do
    invoice = Billing.issue_invoice!(%{
      reference: "INV-005",
      subtotal: Money.new!(1000, :usd),
      adjustments: [Money.new!(5, :usd)]
    })

    assert {:ok, updated} = Billing.apply_adjustment(invoice, Money.new!(10, :usd))
    assert updated.adjustments == [Money.new!(5, :usd), Money.new!(10, :usd)]

    assert {:error, error} = Billing.apply_adjustment(invoice, Money.new!(10, :eur))
    assert [invalid_arg_error] = error.errors
    assert invalid_arg_error.field == :adjustment
    assert invalid_arg_error.message == "must use the currency of the subtotal"

    fetched = Billing.get_invoice!(invoice.id)
    assert fetched.adjustments == [Money.new!(5, :usd), Money.new!(10, :usd)]
  end

  test "calculations :total and :balance" do
    invoice = Billing.issue_invoice!(%{
      reference: "INV-006",
      subtotal: Money.new!(1000, :usd),
      adjustments: [Money.new!(50, :usd), Money.new!(-10, :usd)]
    })

    invoice = Ash.load!(invoice, [:total, :balance, :paid_minor])
    assert invoice.total == Money.new!(1040, :usd)
    assert invoice.balance == Money.new!(1040, :usd)
    assert invoice.paid_minor == 0

    Billing.record_payment!(%{amount: Money.new!(400, :usd), invoice_id: invoice.id})
    Billing.record_payment!(%{amount: Money.new!(140, :usd), invoice_id: invoice.id})

    invoice = Billing.get_invoice!(invoice.id) |> Ash.load!([:total, :balance, :paid_minor])
    assert invoice.paid_minor == 540
    assert invoice.total == Money.new!(1040, :usd)
    assert invoice.balance == Money.new!(500, :usd)
  end

  test "generic action price_for" do
    unit_price = Money.new!(1250, :usd)
    assert {:ok, price} = Billing.price_for(unit_price, 3)
    assert price == Money.new!(3750, :usd)

    assert price_bang = Billing.price_for!(unit_price, 4)
    assert price_bang == Money.new!(5000, :usd)
  end

  test "payment attributes are derived correctly" do
    invoice = Billing.issue_invoice!(%{
      reference: "INV-007",
      subtotal: Money.new!(1000, :usd)
    })

    payment = Billing.record_payment!(%{
      amount: Money.new!(500, :usd),
      invoice_id: invoice.id
    })

    assert payment.amount_minor == 500
    assert payment.amount_currency == :usd
  end

  test "querying and sorting on subtotal" do
    # Create some invoices with different subtotals
    _i1 = Billing.issue_invoice!(%{reference: "A", subtotal: Money.new!(100, :usd)})
    _i2 = Billing.issue_invoice!(%{reference: "B", subtotal: Money.new!(500, :usd)})
    _i3 = Billing.issue_invoice!(%{reference: "C", subtotal: Money.new!(200, :usd)})
    _i4 = Billing.issue_invoice!(%{reference: "D", subtotal: Money.new!(200, :eur)})

    # Sort ascending on subtotal
    query = Invoice
            |> filter(subtotal[:currency] == :usd)
            |> sort(subtotal: :asc)

    results = Ash.read!(query)
    assert Enum.map(results, & &1.reference) == ["A", "C", "B"]

    # Sort descending
    query_desc = Invoice
                 |> filter(subtotal[:currency] == :usd)
                 |> sort(subtotal: :desc)

    results_desc = Ash.read!(query_desc)
    assert Enum.map(results_desc, & &1.reference) == ["B", "C", "A"]

    # Equality filter on subtotal
    target_money = Money.new!(200, :usd)
    query_eq = Invoice
               |> filter(subtotal == ^target_money)

    results_eq = Ash.read!(query_eq)
    assert Enum.map(results_eq, & &1.reference) == ["C"]
  end
end
