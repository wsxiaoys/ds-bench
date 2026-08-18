CREATE MIGRATION m1ituluyhechuf4aorwgfed47rl5674foxlmcrjfrskwhttzygxxca
    ONTO m1uwkclxqsyrrqpmcym7rt6r6brf25fjwgoy5nxjloiosni7mvtfxa
{
  CREATE MODULE billing IF NOT EXISTS;
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
      CREATE REQUIRED PROPERTY line_total := (util::money_round((<std::decimal>.qty * .unit_price)));
      CREATE REQUIRED PROPERTY description: std::str;
  };
  ALTER TYPE billing::Invoice {
      CREATE MULTI LINK lines := (.<invoice[IS billing::LineItem]);
      CREATE REQUIRED PROPERTY subtotal := (util::money_round(std::sum(.lines.line_total)));
      CREATE REQUIRED PROPERTY total_due := (util::apply_discount(.subtotal, .customer.discount_pct, .minimum_charge));
  };
  CREATE FUNCTION billing::customer_outstanding(customer_name: std::str) ->  std::decimal {
      SET volatility := 'Stable';
      USING (util::money_round(std::sum(((SELECT
          billing::Invoice
      FILTER
          ((.customer.name = customer_name) AND NOT (.paid))
      )).total_due)))
  ;};
};
