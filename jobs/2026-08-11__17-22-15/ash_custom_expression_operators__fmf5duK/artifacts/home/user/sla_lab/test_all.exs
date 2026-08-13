# test_all.exs
# Start the application
Application.put_env(:ash, :custom_expressions, [
  SlaLab.Expressions.RouteKey,
  SlaLab.Expressions.RatioBps
])

ExUnit.start()

defmodule SlaLabTest do
  use ExUnit.Case
  import Ash.Expr
  require Ash.Query

  alias SlaLab.Ops.Shipment
  alias SlaLab.Ops.Carrier

  setup do
    # Ensure application is started
    {:ok, _} = Application.ensure_all_started(:sla_lab)
    # Seed
    %{carriers: carriers, shipments: shipments} = SlaLab.Ops.Seed.seed!()
    {:ok, carriers: carriers, shipments: shipments}
  end

  test "RouteKey custom expression basic logic" do
    assert SlaLab.Expressions.RouteKey.route_key("ams", "jfk") == "AMS|JFK"
    assert SlaLab.Expressions.RouteKey.route_key("jfk", "ams") == "AMS|JFK"
    assert SlaLab.Expressions.RouteKey.route_key("AMS", "ams") == "AMS|AMS"
    assert SlaLab.Expressions.RouteKey.route_key(nil, "ams") == nil
    assert SlaLab.Expressions.RouteKey.route_key("ams", nil) == nil
  end

  test "RatioBps custom expression basic logic" do
    assert SlaLab.Expressions.RatioBps.ratio_bps(1, 3) == 3333
    assert SlaLab.Expressions.RatioBps.ratio_bps(2, 3) == 6667
    assert SlaLab.Expressions.RatioBps.ratio_bps(1, 32) == 313
    assert SlaLab.Expressions.RatioBps.ratio_bps(3, 32) == 938
    assert SlaLab.Expressions.RatioBps.ratio_bps(3, 1) == 20000
    assert SlaLab.Expressions.RatioBps.ratio_bps(-1, 4) == 0
    assert SlaLab.Expressions.RatioBps.ratio_bps(1, 0) == nil
    assert SlaLab.Expressions.RatioBps.ratio_bps(nil, 4) == nil
    assert SlaLab.Expressions.RatioBps.ratio_bps(1, nil) == nil
  end

  test "RouteKey and RatioBps callable by name in Ash expressions" do
    # Test eval
    assert {:ok, "AMS|JFK"} = Ash.Expr.eval(expr(route_key("ams", "jfk")))
    assert {:ok, 3333} = Ash.Expr.eval(expr(ratio_bps(1, 3)))

    # Test NoSuchFunction when invalid argument types
    assert_raise Ash.Error.Query.NoSuchFunction, fn ->
      # passing map instead of string to route_key
      Ash.Expr.eval!(expr(route_key(%{}, "jfk")))
    end

    assert_raise Ash.Error.Query.NoSuchFunction, fn ->
      # passing non-numeric string instead of integer to ratio_bps
      Ash.Expr.eval!(expr(ratio_bps("abc", 3)))
    end
  end

  test "Shipment expression calculations", %{shipments: shipments} do
    # S01: "S01", "NORDIC", "ams", "jfk", 48, 24, :standard
    # route_key: "AMS|JFK", sla_ratio_bps: 24 * 10000 / 48 = 5000, status_label: "met"
    s01 = Ash.get!(Shipment, shipments["S01"].id, load: [:route_key, :sla_ratio_bps, :status_label], authorize?: false)
    assert s01.route_key == "AMS|JFK"
    assert s01.sla_ratio_bps == 5000
    assert s01.status_label == "met"

    # S02: "S02", "NORDIC", "jfk", "ams", 48, 96, :express
    # route_key: "AMS|JFK", sla_ratio_bps: 96 * 10000 / 48 = 20000, status_label: "breached"
    s02 = Ash.get!(Shipment, shipments["S02"].id, load: [:route_key, :sla_ratio_bps, :status_label], authorize?: false)
    assert s02.route_key == "AMS|JFK"
    assert s02.sla_ratio_bps == 20000
    assert s02.status_label == "breached"

    # S03: "S03", "NORDIC", "ams", "lhr", 24, nil, :critical
    # route_key: "AMS|LHR", sla_ratio_bps: nil, status_label: "pending"
    s03 = Ash.get!(Shipment, shipments["S03"].id, load: [:route_key, :sla_ratio_bps, :status_label], authorize?: false)
    assert s03.route_key == "AMS|LHR"
    assert s03.sla_ratio_bps == nil
    assert s03.status_label == "pending"
  end

  test "Shipment calculations usable in filter and sort" do
    # Filter by sla_ratio_bps
    query = Shipment |> Ash.Query.filter(expr(sla_ratio_bps > 10000))
    results = Ash.read!(query, authorize?: false)
    assert Enum.map(results, & &1.reference) |> Enum.sort() == ["S02", "S05", "S10"]

    # Sort by sla_ratio_bps
    query = Shipment |> Ash.Query.sort(sla_ratio_bps: :asc_nils_last)
    results = Ash.read!(query, authorize?: false)
    # nil should be last, sorted values first (S04: 1*10000/32=313, S07: 3*10000/32=938, S01: 5000, S06: 10000, S05: 15000, S02: 20000, S10: 50000 capped to 20000)
    references = Enum.map(results, & &1.reference)
    assert Enum.take(references, 4) == ["S04", "S07", "S01", "S06"]
    assert Enum.take(references, -3) |> Enum.sort() == ["S03", "S08", "S09"]
  end

  test "shipments_on_route domain code interface" do
    results = SlaLab.Ops.shipments_on_route!("AMS|JFK", authorize?: false)
    assert Enum.map(results, & &1.reference) |> Enum.sort() == ["S01", "S02"]
  end

  test "record_delivery atomic validation and error output", %{shipments: shipments} do
    s01 = shipments["S01"] # promised_hours = 48

    # Update with actual_hours = 24 (ratio = 5000 <= 15000) -> should succeed
    {:ok, updated} = Ash.update(s01, %{actual_hours: 24}, action: :record_delivery, authorize?: false)
    assert updated.actual_hours == 24

    # Update with actual_hours = 73 (ratio = 73 * 10000 / 48 = 15208 > 15000) -> should fail
    {:error, %Ash.Error.Invalid{errors: [invalid_attr]}} =
      Ash.update(s01, %{actual_hours: 73}, action: :record_delivery, authorize?: false)

    assert invalid_attr.field == :actual_hours
    assert invalid_attr.message == "delivery ratio exceeds the allowed maximum"

    # Test bulk update
    results = Ash.bulk_update([s01], :record_delivery, %{actual_hours: 73}, strategy: [:atomic], authorize?: false, return_errors?: true)
    assert results.status == :error
    [%Ash.Error.Invalid{errors: [invalid_attr]}] = results.errors
    assert invalid_attr.field == :actual_hours
    assert invalid_attr.message == "delivery ratio exceeds the allowed maximum"
  end

  test "Carrier aggregates", %{carriers: carriers} do
    # NORDIC:
    # Shipments:
    # S01: actual_hours = 24 (delivered)
    # S02: actual_hours = 96 (delivered, ratio = 20000 > 10000 -> breach)
    # S03: actual_hours = nil (not delivered)
    # S04: actual_hours = 1 (delivered, ratio = 313 <= 10000 -> no breach)
    # S10: actual_hours = 40 (delivered, ratio = 40*10000/8 = 50000 capped to 20000 > 10000 -> breach)
    # Delivered count = 4, Breach count = 2
    # Breach rate = 2 * 10000 / 4 = 5000
    nordic = Ash.get!(Carrier, carriers["NORDIC"].id, load: [:delivered_count, :breach_count, :breach_rate_bps], authorize?: false)
    assert nordic.delivered_count == 4
    assert nordic.breach_count == 2
    assert nordic.breach_rate_bps == 5000

    # ARCTIC:
    # Shipments: S08 (nil), S09 (nil)
    # Delivered count = 0, Breach count = 0
    # Breach rate = nil
    arctic = Ash.get!(Carrier, carriers["ARCTIC"].id, load: [:delivered_count, :breach_count, :breach_rate_bps], authorize?: false)
    assert arctic.delivered_count == 0
    assert arctic.breach_count == 0
    assert arctic.breach_rate_bps == nil
  end

  test "Custom expressions directly on aggregates in filter/exists" do
    # Carrier filter with custom expression on aggregates
    query = Carrier |> Ash.Query.filter(expr(ratio_bps(breach_count, delivered_count) > 4000))
    results = Ash.read!(query, authorize?: false)
    assert Enum.map(results, & &1.code) == ["NORDIC"]

    # Filter with exists
    query = Carrier |> Ash.Query.filter(expr(exists(shipments, ratio_bps(actual_hours, promised_hours) > 15000)))
    results = Ash.read!(query, authorize?: false)
    assert Enum.map(results, & &1.code) |> Enum.sort() == ["NORDIC"]
  end

  test "Policies on Shipment", %{shipments: shipments} do
    s01 = shipments["S01"] # route_key: "AMS|JFK"

    # nil actor -> should fail with Forbidden
    assert_raise Ash.Error.Forbidden, fn ->
      Ash.get!(Shipment, s01.id, actor: nil)
    end

    # Actor with matching home_route
    actor_matching = %{home_route: "AMS|JFK", role: :user}
    assert %Shipment{} = Ash.get!(Shipment, s01.id, actor: actor_matching)

    # Actor with non-matching home_route
    actor_non_matching = %{home_route: "SIN|HKG", role: :user}
    assert_raise Ash.Error.Invalid, fn ->
      Ash.get!(Shipment, s01.id, actor: actor_non_matching)
    end

    # Admin actor with non-matching home_route
    actor_admin = %{home_route: "SIN|HKG", role: :admin}
    assert %Shipment{} = Ash.get!(Shipment, s01.id, actor: actor_admin)
  end

  test "PenaltyPoints custom query function" do
    # Programmatic construction
    assert SlaLab.Expressions.PenaltyPoints.args() == [[:integer, :integer]]
    assert SlaLab.Expressions.PenaltyPoints.returns() == [:integer]
    assert SlaLab.Expressions.PenaltyPoints.name() == :penalty_points
    assert SlaLab.Expressions.PenaltyPoints.predicate?() == false

    # Test evaluation
    node = %SlaLab.Expressions.PenaltyPoints{arguments: [10, 5]}
    assert {:known, 50} = SlaLab.Expressions.PenaltyPoints.evaluate(node)

    # Test other values
    # late_hours <= 0
    n1 = %SlaLab.Expressions.PenaltyPoints{arguments: [-5, 10]}
    assert {:known, 0} = SlaLab.Expressions.PenaltyPoints.evaluate(n1)

    # late_hours in 1..24
    n2 = %SlaLab.Expressions.PenaltyPoints{arguments: [10, 5]}
    assert {:known, 50} = SlaLab.Expressions.PenaltyPoints.evaluate(n2)

    # late_hours > 24
    n3 = %SlaLab.Expressions.PenaltyPoints{arguments: [26, 5]}
    # 24 * 5 + 2 * 5 * 2 = 120 + 20 = 140
    assert {:known, 140} = SlaLab.Expressions.PenaltyPoints.evaluate(n3)

    # negative weight
    n4 = %SlaLab.Expressions.PenaltyPoints{arguments: [10, -5]}
    assert {:error, "penalty weight must not be negative"} = SlaLab.Expressions.PenaltyPoints.evaluate(n4)

    # non-integer -> :unknown
    n5 = %SlaLab.Expressions.PenaltyPoints{arguments: ["10", 5]}
    assert :unknown = SlaLab.Expressions.PenaltyPoints.evaluate(n5)

    # nil argument yields nil value
    n6 = %SlaLab.Expressions.PenaltyPoints{arguments: [nil, 5]}
    assert {:known, nil} = SlaLab.Expressions.PenaltyPoints.evaluate(n6)
  end
end
