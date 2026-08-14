defmodule SlaLab.Verify do
  import ExUnit.Assertions
  import Ash.Expr
  require Ash.Query

  def run do
    IO.puts("--- Starting verification ---")

    # 0. Seed database
    IO.puts("Seeding database...")
    %{carriers: carriers, shipments: shipments} = SlaLab.Ops.Seed.seed!()

    # 1. Test custom expressions directly
    IO.puts("Testing RouteKey custom expression...")
    assert SlaLab.Expressions.RouteKey.route_key("ams", "jfk") == "AMS|JFK"
    assert SlaLab.Expressions.RouteKey.route_key("jfk", "ams") == "AMS|JFK"
    assert SlaLab.Expressions.RouteKey.route_key("AMS", "ams") == "AMS|AMS"
    assert SlaLab.Expressions.RouteKey.route_key("ams", nil) == nil
    assert SlaLab.Expressions.RouteKey.route_key(nil, "jfk") == nil

    IO.puts("Testing RatioBps custom expression...")
    assert SlaLab.Expressions.RatioBps.ratio_bps(1, 3) == 3333
    assert SlaLab.Expressions.RatioBps.ratio_bps(2, 3) == 6667
    assert SlaLab.Expressions.RatioBps.ratio_bps(1, 32) == 313
    assert SlaLab.Expressions.RatioBps.ratio_bps(3, 32) == 938
    assert SlaLab.Expressions.RatioBps.ratio_bps(3, 1) == 20_000
    assert SlaLab.Expressions.RatioBps.ratio_bps(-1, 4) == 0
    assert SlaLab.Expressions.RatioBps.ratio_bps(1, 0) == nil
    assert SlaLab.Expressions.RatioBps.ratio_bps(nil, 4) == nil

    # 2. Test SlaLab.Ops.Shipment calculations
    IO.puts("Testing Shipment calculations...")
    # S01: ams -> jfk, promised 48, actual 24
    # Route key: AMS|JFK
    # SLA ratio: 24 * 10000 / 48 = 5000
    # Status label: met
    s01 = Ash.get!(SlaLab.Ops.Shipment, shipments["S01"].id, load: [:route_key, :sla_ratio_bps, :status_label], authorize?: false)
    assert s01.route_key == "AMS|JFK"
    assert s01.sla_ratio_bps == 5000
    assert s01.status_label == "met"

    # S02: jfk -> ams, promised 48, actual 96
    # Route key: AMS|JFK
    # SLA ratio: 96 * 10000 / 48 = 20000
    # Status label: breached
    s02 = Ash.get!(SlaLab.Ops.Shipment, shipments["S02"].id, load: [:route_key, :sla_ratio_bps, :status_label], authorize?: false)
    assert s02.route_key == "AMS|JFK"
    assert s02.sla_ratio_bps == 20000
    assert s02.status_label == "breached"

    # S03: ams -> lhr, promised 24, actual nil
    # Route key: AMS|LHR
    # SLA ratio: nil
    # Status label: pending
    s03 = Ash.get!(SlaLab.Ops.Shipment, shipments["S03"].id, load: [:route_key, :sla_ratio_bps, :status_label], authorize?: false)
    assert s03.route_key == "AMS|LHR"
    assert s03.sla_ratio_bps == nil
    assert s03.status_label == "pending"

    # 3. Test filters and sorts using calculations
    IO.puts("Testing Shipment filters and sorts...")
    # Filter by sla_ratio_bps
    query = Ash.Query.filter(SlaLab.Ops.Shipment, expr(sla_ratio_bps > 10000))
    breached_shipments = Ash.read!(query, authorize?: false)
    assert Enum.any?(breached_shipments, &(&1.reference == "S02"))
    assert Enum.any?(breached_shipments, &(&1.reference == "S10")) # S10: CDG|AMS promised 8, actual 40 -> 50_000 bps -> clamped to 20_000 bps

    # Sort by sla_ratio_bps
    query = Ash.Query.sort(SlaLab.Ops.Shipment, sla_ratio_bps: :asc)
    sorted_shipments = Ash.read!(query, authorize?: false) |> Ash.load!([:sla_ratio_bps])
    # The non-nil ratios should be in ascending order
    ratios = sorted_shipments |> Enum.map(& &1.sla_ratio_bps) |> Enum.reject(&is_nil/1)
    assert ratios == Enum.sort(ratios)

    # 4. Test code interface shipments_on_route
    IO.puts("Testing shipments_on_route code interface...")
    on_route_shipments = SlaLab.Ops.shipments_on_route!("AMS|JFK", authorize?: false)
    references = Enum.map(on_route_shipments, & &1.reference)
    assert "S01" in references
    assert "S02" in references
    assert length(references) == 2

    # 5. Test update action record_delivery and validation
    IO.puts("Testing record_delivery update action and validation...")
    # S01: promised 48. If we update actual_hours to 24, ratio is 5000 (<= 15000) -> should succeed
    s01_updated = Ash.update!(s01, %{actual_hours: 24}, action: :record_delivery, authorize?: false)
    assert s01_updated.actual_hours == 24

    # If we update actual_hours to 73, ratio is 73 * 10000 / 48 = 15208 (> 15000) -> should fail
    assert_raise Ash.Error.Invalid, ~r/delivery ratio exceeds the allowed maximum/, fn ->
      Ash.update!(s01, %{actual_hours: 73}, action: :record_delivery, authorize?: false)
    end

    # Verify error structure exactly: "produce an Ash.Error.Invalid wrapping an Ash.Error.Changes.InvalidAttribute whose field is :actual_hours and whose message is exactly delivery ratio exceeds the allowed maximum."
    try do
      Ash.update!(s01, %{actual_hours: 73}, action: :record_delivery, authorize?: false)
    rescue
      e in Ash.Error.Invalid ->
        [invalid_attr_error] = e.errors
        assert invalid_attr_error.__struct__ == Ash.Error.Changes.InvalidAttribute
        assert invalid_attr_error.field == :actual_hours
        assert invalid_attr_error.message == "delivery ratio exceeds the allowed maximum"
    end

    # Test bulk update with atomic strategy
    IO.puts("Testing bulk update record_delivery...")
    bulk_result = Ash.bulk_update([s01], :record_delivery, %{actual_hours: 73}, strategy: [:atomic], authorize?: false, return_errors?: true)
    IO.inspect(bulk_result, label: "bulk_result")
    assert bulk_result.status == :error
    [bulk_error] = bulk_result.errors
    assert bulk_error.__struct__ == Ash.Error.Invalid
    [invalid_attr_error] = bulk_error.errors
    assert invalid_attr_error.__struct__ == Ash.Error.Changes.InvalidAttribute
    assert invalid_attr_error.field == :actual_hours
    assert invalid_attr_error.message == "delivery ratio exceeds the allowed maximum"

    # 6. Test Carrier aggregates and calculations
    IO.puts("Testing Carrier aggregates and calculations...")
    # NORDIC carrier code "NORDIC"
    # Shipments:
    # S01: Standard, actual 24 (non-nil)
    # S02: Express, actual 96 (non-nil), ratio 20000 (breached)
    # S03: Critical, actual nil (nil)
    # S04: Standard, actual 1 (non-nil), ratio 1 * 10000 / 32 = 313 (met)
    # S10: Standard, actual 40 (non-nil), ratio 40 * 10000 / 8 = 50000 -> 20000 (breached)
    # Total delivered: S01, S02, S04, S10 = 4
    # Total breached: S02, S10 = 2
    # Breach rate bps: 2 * 10000 / 4 = 5000
    nordic = Ash.get!(SlaLab.Ops.Carrier, carriers["NORDIC"].id, load: [:delivered_count, :breach_count, :breach_rate_bps], authorize?: false)
    assert nordic.delivered_count == 4
    assert nordic.breach_count == 2
    assert nordic.breach_rate_bps == 5000

    # 7. Test both building blocks applied directly to aggregates in Ash.Query.filter and exists
    IO.puts("Testing building blocks applied directly to aggregates in filters and exists...")
    # Let's filter carriers where ratio_bps(breach_count, delivered_count) > 4000
    query = Ash.Query.filter(SlaLab.Ops.Carrier, expr(ratio_bps(breach_count, delivered_count) > 4000))
    carriers_filtered = Ash.read!(query, authorize?: false)
    assert Enum.any?(carriers_filtered, &(&1.code == "NORDIC"))

    # Let's filter carriers using exists/2
    # e.g., carriers that have a shipment whose route key is "AMS|JFK"
    query = Ash.Query.filter(SlaLab.Ops.Carrier, expr(exists(shipments, route_key(origin_zone, destination_zone) == "AMS|JFK")))
    carriers_exists = Ash.read!(query, authorize?: false)
    assert Enum.any?(carriers_exists, &(&1.code == "NORDIC"))

    # 8. Test policies on Shipment
    IO.puts("Testing Shipment policies...")
    # reads are authorised only when the actor's :home_route equals the shipment's route key
    # S01 route key is "AMS|JFK"
    # actor whose :home_route is "AMS|JFK" can read S01
    actor_ok = %{home_route: "AMS|JFK", role: :user}
    s01_read = Ash.get!(SlaLab.Ops.Shipment, s01.id, actor: actor_ok)
    assert s01_read.id == s01.id

    # actor whose :home_route is "AMS|LHR" cannot read S01
    actor_bad = %{home_route: "AMS|LHR", role: :user}
    assert_raise Ash.Error.Invalid, fn ->
      Ash.get!(SlaLab.Ops.Shipment, s01.id, actor: actor_bad)
    end

    # actor whose :role is :admin may read every shipment regardless of its route
    actor_admin = %{role: :admin}
    s01_admin = Ash.get!(SlaLab.Ops.Shipment, s01.id, actor: actor_admin)
    assert s01_admin.id == s01.id

    # nil actor is refused with Ash.Error.Forbidden
    assert_raise Ash.Error.Forbidden, fn ->
      Ash.get!(SlaLab.Ops.Shipment, s01.id, actor: nil)
    end

    # 9. Test custom query function SlaLab.Expressions.PenaltyPoints
    IO.puts("Testing SlaLab.Expressions.PenaltyPoints query function...")
    # Programmatic construction
    {:ok, node} = Ash.Query.Function.new(SlaLab.Expressions.PenaltyPoints, [ref(:actual_hours), 5])
    assert node.__struct__ == SlaLab.Expressions.PenaltyPoints
    assert node.arguments == [ref(:actual_hours), 5]

    # Test evaluation rules
    # 1. late_hours <= 0 -> 0
    node = %SlaLab.Expressions.PenaltyPoints{arguments: [0, 5]}
    assert Ash.Query.Function.evaluate(node) == {:known, 0}
    node = %SlaLab.Expressions.PenaltyPoints{arguments: [-5, 5]}
    assert Ash.Query.Function.evaluate(node) == {:known, 0}

    # 2. late_hours 1..24 -> late_hours * weight
    node = %SlaLab.Expressions.PenaltyPoints{arguments: [10, 5]}
    assert Ash.Query.Function.evaluate(node) == {:known, 50}
    node = %SlaLab.Expressions.PenaltyPoints{arguments: [24, 5]}
    assert Ash.Query.Function.evaluate(node) == {:known, 120}

    # 3. late_hours > 24 -> 24 * weight + (late_hours - 24) * weight * 2
    # e.g. late_hours = 25, weight = 5 -> 24 * 5 + 1 * 5 * 2 = 120 + 10 = 130
    node = %SlaLab.Expressions.PenaltyPoints{arguments: [25, 5]}
    assert Ash.Query.Function.evaluate(node) == {:known, 130}

    # 4. weight < 0 -> {:error, "penalty weight must not be negative"}
    node = %SlaLab.Expressions.PenaltyPoints{arguments: [10, -5]}
    assert Ash.Query.Function.evaluate(node) == {:error, "penalty weight must not be negative"}

    # 5. any argument not an integer -> :unknown
    node = %SlaLab.Expressions.PenaltyPoints{arguments: ["foo", 5]}
    assert Ash.Query.Function.evaluate(node) == :unknown

    # 6. nil argument yields nil
    node = %SlaLab.Expressions.PenaltyPoints{arguments: [nil, 5]}
    assert Ash.Query.Function.evaluate(node) == {:known, nil}
    node = %SlaLab.Expressions.PenaltyPoints{arguments: [10, nil]}
    assert Ash.Query.Function.evaluate(node) == {:known, nil}

    # Test evaluating inside expressions (Ash.Expr.eval/2)
    # e.g., record binding
    node = %SlaLab.Expressions.PenaltyPoints{arguments: [25, 5]}
    assert Ash.Expr.eval!(node, record: s01) == 130

    IO.puts("--- Verification successful! All tests passed! ---")
  end
end

SlaLab.Verify.run()
