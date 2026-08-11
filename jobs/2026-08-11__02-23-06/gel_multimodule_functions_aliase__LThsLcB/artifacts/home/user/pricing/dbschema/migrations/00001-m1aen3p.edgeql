CREATE MIGRATION m1aen3ptz6bwnl5vrymwihyj7m73vphbminxoj5kumlfyhjpkrttyq
    ONTO initial
{
  CREATE MODULE billing IF NOT EXISTS;
  CREATE MODULE util IF NOT EXISTS;
  CREATE FUNCTION util::apply_discount(amount: std::decimal, pct: std::decimal, floor_amount: OPTIONAL std::decimal) ->  std::decimal USING (WITH
      d := 
          std::round((amount * (1n - (pct / 100n))), 2)
  SELECT
      std::max(({d} UNION floor_amount))
  );
  CREATE FUNCTION util::money_round(amount: std::decimal) ->  std::decimal USING (std::round(amount, 2));
  CREATE TYPE billing::Customer {
      CREATE REQUIRED PROPERTY discount_pct: std::decimal {
          SET default := 0n;
      };
      CREATE REQUIRED PROPERTY name: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  CREATE TYPE billing::Invoice {
      CREATE REQUIRED LINK customer: billing::Customer;
      CREATE PROPERTY minimum_charge: std::decimal;
      CREATE REQUIRED PROPERTY paid: std::bool {
          SET default := false;
      };
      CREATE REQUIRED PROPERTY code: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED PROPERTY installment_count: std::int64 {
          SET default := 1;
      };
  };
  CREATE TYPE billing::LineItem {
      CREATE REQUIRED LINK invoice: billing::Invoice;
      CREATE REQUIRED PROPERTY qty: std::int64;
      CREATE REQUIRED PROPERTY unit_price: std::decimal {
          CREATE CONSTRAINT std::expression ON ((__subject__ = util::money_round(__subject__)));
      };
      CREATE PROPERTY line_total := (util::money_round((.qty * .unit_price)));
      CREATE REQUIRED PROPERTY description: std::str;
  };
  ALTER TYPE billing::Invoice {
      CREATE MULTI LINK lines := (.<invoice[IS billing::LineItem]);
      CREATE PROPERTY subtotal := (util::money_round(std::sum(.lines.line_total)));
      CREATE PROPERTY total_due := (util::apply_discount(.subtotal, .customer.discount_pct, .minimum_charge));
  };
  CREATE FUNCTION billing::customer_outstanding(customer_name: std::str) ->  std::decimal {
      SET volatility := 'Stable';
      USING (util::money_round(std::sum(((SELECT
          billing::Invoice
      FILTER
          ((.customer.name = customer_name) AND NOT (.paid))
      )).total_due)))
  ;};
  CREATE FUNCTION util::gross_with_tax(net: std::decimal, NAMED ONLY tax_pct: std::decimal = 0) ->  std::decimal USING (std::round((net * (1n + (tax_pct / 100n))), 2));
  CREATE FUNCTION util::installments(total: std::decimal, count: std::int64) -> SET OF std::decimal USING (WITH
      denominator := 
          (IF (count < 1) THEN 1 ELSE count)
      ,
      each_val := 
          std::round((total / denominator), 2)
  SELECT
      (IF (count < 1) THEN <std::decimal>{} ELSE (WITH
          indices := 
              std::range_unpack(std::range(1, (count + 1)))
      SELECT
          (IF (indices < count) THEN each_val ELSE (total - ((count - 1) * each_val)))
      ))
  );
  CREATE FUNCTION util::money_round(amount: std::decimal, places: std::int64) ->  std::decimal USING (std::round(amount, places));
  CREATE FUNCTION util::total_of(VARIADIC amounts: std::decimal) ->  std::decimal USING (std::round(std::sum(std::array_unpack(amounts)), 2));
};
